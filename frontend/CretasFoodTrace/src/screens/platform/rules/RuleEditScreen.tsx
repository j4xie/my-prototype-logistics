import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Appbar,
  Text,
  Card,
  Chip,
  Button,
  TextInput,
  Switch,
  Menu,
  Divider,
  ActivityIndicator,
  IconButton,
  Portal,
  Modal,
  SegmentedButtons,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import {
  ruleConfigApiClient,
  DroolsRule,
  RuleGroup,
  EntityType,
  CreateRuleRequest,
  UpdateRuleRequest,
} from '../../../services/api/ruleConfigApiClient';
import { useAuthStore } from '../../../store/authStore';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('RuleEditScreen');

// Route params type
type RuleEditRouteParams = {
  RuleEdit: {
    ruleId?: string;
    type?: string;
  };
};

// Rule categories with labels and colors
const RULE_GROUPS: {
  key: RuleGroup;
  label: string;
  labelEn: string;
  color: string;
  icon: string;
}[] = [
  { key: 'validation', label: '验证规则', labelEn: 'Validation', color: '#1890ff', icon: 'check-circle' },
  { key: 'workflow', label: '工作流', labelEn: 'Workflow', color: '#52c41a', icon: 'sitemap' },
  { key: 'quality', label: '质检', labelEn: 'Quality', color: '#722ed1', icon: 'shield-check' },
  { key: 'costing', label: '成本', labelEn: 'Costing', color: '#fa8c16', icon: 'currency-usd' },
  { key: 'alert', label: '告警', labelEn: 'Alert', color: '#f5222d', icon: 'alert' },
];

// Entity types for condition builder
const ENTITY_TYPES: { key: EntityType; label: string; labelEn: string }[] = [
  { key: 'MaterialBatch', label: '原料批次', labelEn: 'Material Batch' },
  { key: 'ProcessingBatch', label: '加工批次', labelEn: 'Processing Batch' },
  { key: 'QualityInspection', label: '质检记录', labelEn: 'Quality Inspection' },
  { key: 'Shipment', label: '出货记录', labelEn: 'Shipment' },
  { key: 'Equipment', label: '设备', labelEn: 'Equipment' },
  { key: 'DisposalRecord', label: '处置记录', labelEn: 'Disposal Record' },
];

// Operators for condition builder
const OPERATORS = [
  { key: '==', label: '等于 (==)' },
  { key: '!=', label: '不等于 (!=)' },
  { key: '>', label: '大于 (>)' },
  { key: '<', label: '小于 (<)' },
  { key: '>=', label: '大于等于 (>=)' },
  { key: '<=', label: '小于等于 (<=)' },
  { key: 'contains', label: '包含' },
  { key: 'matches', label: '匹配' },
];

// Action types for then section
const ACTION_TYPES = [
  { key: 'setField', label: '设置字段值', labelEn: 'Set Field Value' },
  { key: 'sendNotification', label: '发送通知', labelEn: 'Send Notification' },
  { key: 'triggerAlert', label: '触发告警', labelEn: 'Trigger Alert' },
  { key: 'updateStatus', label: '更新状态', labelEn: 'Update Status' },
  { key: 'insertFact', label: '插入事实', labelEn: 'Insert Fact' },
];

// Default imports
const DEFAULT_IMPORTS = [
  'com.cretas.aims.entity.MaterialBatch',
  'java.time.LocalDate',
  'java.time.LocalDateTime',
];

// DRL template
const DRL_TEMPLATE = `package com.cretas.rules

import com.cretas.aims.entity.MaterialBatch
import java.time.LocalDate

rule "规则名称"
    salience 50
    when
        $batch : MaterialBatch(
            // 添加条件
        )
    then
        // 添加动作
end`;

interface Condition {
  id: string;
  entity: EntityType;
  field: string;
  operator: string;
  value: string;
}

interface Action {
  id: string;
  type: string;
  target: string;
  value: string;
}

export default function RuleEditScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RuleEditRouteParams, 'RuleEdit'>>();
  const { t, i18n } = useTranslation();
  const { factoryId } = useAuthStore();

  const ruleId = route.params?.ruleId;
  const isEditMode = !!ruleId;

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Creation method: 'manual' or 'ai'
  const [creationMethod, setCreationMethod] = useState<'manual' | 'ai'>('manual');

  // Form data
  const [ruleName, setRuleName] = useState('');
  const [ruleIdInput, setRuleIdInput] = useState('');
  const [ruleGroup, setRuleGroup] = useState<RuleGroup>('validation');
  const [priority, setPriority] = useState(50);
  const [description, setDescription] = useState('');
  const [drlContent, setDrlContent] = useState(DRL_TEMPLATE);

  // Condition builder
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([]);

  // Imports
  const [imports, setImports] = useState<string[]>(DEFAULT_IMPORTS);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newImport, setNewImport] = useState('');

  // Advanced settings
  const [enabledImmediately, setEnabledImmediately] = useState(true);
  const [logExecution, setLogExecution] = useState(true);
  const [interruptOnFailure, setInterruptOnFailure] = useState(false);

  // Menu states
  const [groupMenuVisible, setGroupMenuVisible] = useState(false);

  // AI input
  const [aiPrompt, setAiPrompt] = useState('');

  // Validation state
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
  } | null>(null);

  // Load existing rule for edit mode
  useEffect(() => {
    if (isEditMode && ruleId) {
      loadRule(ruleId);
    }
  }, [isEditMode, ruleId]);

  const loadRule = async (id: string) => {
    if (!factoryId) return;

    setLoading(true);
    try {
      const rule = await ruleConfigApiClient.getRuleById(factoryId, id);
      setRuleName(rule.ruleName);
      setRuleIdInput(rule.ruleId);
      setRuleGroup(rule.ruleGroup);
      setPriority(rule.priority || 50);
      setDescription(rule.ruleDescription || '');
      setDrlContent(rule.ruleContent);
      setEnabledImmediately(rule.enabled);
      logger.info('Rule loaded successfully', { ruleId: id });
    } catch (error) {
      logger.error('Failed to load rule', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('rules.loadFailed', 'Failed to load rule')
      );
    } finally {
      setLoading(false);
    }
  };

  const generateRuleId = () => {
    const prefix = ruleGroup.toUpperCase().substring(0, 3);
    const timestamp = Date.now().toString(36).toUpperCase();
    return `RULE-${prefix}-${timestamp}`;
  };

  const handleGroupSelect = (group: RuleGroup) => {
    setRuleGroup(group);
    setGroupMenuVisible(false);
    // Auto-generate rule ID if empty
    if (!ruleIdInput) {
      const prefix = group.toUpperCase().substring(0, 3);
      const timestamp = Date.now().toString(36).toUpperCase();
      setRuleIdInput(`RULE-${prefix}-${timestamp}`);
    }
  };

  const getGroupConfig = (group: RuleGroup) => {
    return RULE_GROUPS.find(g => g.key === group) || RULE_GROUPS[0];
  };

  // Add condition
  const addCondition = () => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      entity: 'MaterialBatch',
      field: '',
      operator: '==',
      value: '',
    };
    setConditions([...conditions, newCondition]);
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(conditions.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  // Add action
  const addAction = () => {
    const newAction: Action = {
      id: Date.now().toString(),
      type: 'setField',
      target: '',
      value: '',
    };
    setActions([...actions, newAction]);
  };

  const updateAction = (id: string, updates: Partial<Action>) => {
    setActions(actions.map(a => (a.id === id ? { ...a, ...updates } : a)));
  };

  const removeAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  // Add import
  const handleAddImport = () => {
    if (newImport.trim() && !imports.includes(newImport.trim())) {
      setImports([...imports, newImport.trim()]);
      setNewImport('');
      setShowImportModal(false);
    }
  };

  const removeImport = (importStr: string) => {
    setImports(imports.filter(i => i !== importStr));
  };

  // Validate DRL
  const validateDRL = async () => {
    if (!factoryId) return;

    setValidating(true);
    try {
      const result = await ruleConfigApiClient.validateDRL(factoryId, drlContent);
      setValidationResult(result);
      if (result.valid) {
        Alert.alert(
          t('rules.validationSuccess', 'Validation Successful'),
          t('rules.drlValid', 'DRL syntax is valid')
        );
      } else {
        Alert.alert(
          t('rules.validationFailed', 'Validation Failed'),
          result.errors.join('\n')
        );
      }
    } catch (error) {
      logger.error('DRL validation failed', error);
      Alert.alert(t('common.error', 'Error'), t('rules.validationError', 'Validation failed'));
    } finally {
      setValidating(false);
    }
  };

  // AI generate rule
  const generateWithAI = async () => {
    if (!factoryId || !aiPrompt.trim()) {
      Alert.alert(t('common.error', 'Error'), t('rules.enterPrompt', 'Please enter a description'));
      return;
    }

    setAiGenerating(true);
    try {
      const response = await ruleConfigApiClient.parseRule(factoryId, {
        userInput: aiPrompt,
        ruleGroup,
        existingRules: [],
      });

      if (response.success && response.generatedDRL) {
        setDrlContent(response.generatedDRL);
        if (response.suggestedName) {
          setRuleName(response.suggestedName);
        }
        if (response.suggestedDescription) {
          setDescription(response.suggestedDescription);
        }
        Alert.alert(
          t('rules.aiGenerated', 'AI Generated'),
          t('rules.drlGeneratedSuccess', 'DRL code has been generated. Please review and modify as needed.')
        );
      } else {
        throw new Error(response.message || 'AI generation failed');
      }
    } catch (error) {
      logger.error('AI rule generation failed', error);
      Alert.alert(t('common.error', 'Error'), t('rules.aiGenerateFailed', 'Failed to generate rule with AI'));
    } finally {
      setAiGenerating(false);
    }
  };

  // Build DRL from conditions (helper)
  const buildDRLFromConditions = useCallback(() => {
    if (conditions.length === 0 && actions.length === 0) return;

    let drl = `package com.cretas.rules\n\n`;

    // Add imports
    imports.forEach(imp => {
      drl += `import ${imp}\n`;
    });

    drl += `\nrule "${ruleName || 'NewRule'}"\n`;
    drl += `    salience ${priority}\n`;
    drl += `    when\n`;

    // Build conditions
    if (conditions.length > 0) {
      const conditionsByEntity = conditions.reduce((acc, c) => {
        if (!acc[c.entity]) acc[c.entity] = [];
        acc[c.entity].push(c);
        return acc;
      }, {} as Record<string, Condition[]>);

      Object.entries(conditionsByEntity).forEach(([entity, conds]) => {
        const varName = `$${entity.charAt(0).toLowerCase()}${entity.slice(1)}`;
        drl += `        ${varName} : ${entity}(\n`;
        conds.forEach((c, idx) => {
          if (c.field && c.value) {
            drl += `            ${c.field} ${c.operator} ${c.value}`;
            drl += idx < conds.length - 1 ? ',\n' : '\n';
          }
        });
        drl += `        )\n`;
      });
    }

    drl += `    then\n`;

    // Build actions
    if (actions.length > 0) {
      actions.forEach(a => {
        switch (a.type) {
          case 'setField':
            drl += `        // Set field: ${a.target} = ${a.value}\n`;
            break;
          case 'sendNotification':
            drl += `        // Send notification: ${a.value}\n`;
            break;
          case 'triggerAlert':
            drl += `        // Trigger alert: ${a.value}\n`;
            break;
          case 'updateStatus':
            drl += `        // Update status: ${a.target} -> ${a.value}\n`;
            break;
          case 'insertFact':
            drl += `        // Insert fact: ${a.value}\n`;
            break;
        }
      });
    } else {
      drl += `        // Add actions here\n`;
    }

    drl += `end`;

    setDrlContent(drl);
  }, [conditions, actions, imports, ruleName, priority]);

  // Save rule
  const handleSave = async () => {
    if (!factoryId) {
      Alert.alert(t('common.error', 'Error'), t('rules.noFactory', 'Factory not selected'));
      return;
    }

    // Validation
    if (!ruleName.trim()) {
      Alert.alert(t('common.error', 'Error'), t('rules.nameRequired', 'Rule name is required'));
      return;
    }

    if (!drlContent.trim()) {
      Alert.alert(t('common.error', 'Error'), t('rules.drlRequired', 'DRL content is required'));
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && ruleId) {
        // Update existing rule
        const updateData: UpdateRuleRequest = {
          ruleName,
          ruleDescription: description,
          ruleContent: drlContent,
          priority,
        };
        await ruleConfigApiClient.updateRule(factoryId, ruleId, updateData);
        logger.info('Rule updated successfully', { ruleId });
        Alert.alert(
          t('common.success', 'Success'),
          t('rules.updateSuccess', 'Rule updated successfully'),
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        // Create new rule
        const createData: CreateRuleRequest = {
          ruleGroup,
          ruleName,
          ruleDescription: description,
          ruleContent: drlContent,
          priority,
          enabled: enabledImmediately,
        };
        await ruleConfigApiClient.createRule(factoryId, createData);
        logger.info('Rule created successfully');
        Alert.alert(
          t('common.success', 'Success'),
          t('rules.createSuccess', 'Rule created successfully'),
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      logger.error('Failed to save rule', error);
      Alert.alert(
        t('common.error', 'Error'),
        isEditMode
          ? t('rules.updateFailed', 'Failed to update rule')
          : t('rules.createFailed', 'Failed to create rule')
      );
    } finally {
      setSaving(false);
    }
  };

  // Navigate to test screen
  const handleTest = () => {
    if (!drlContent.trim()) {
      Alert.alert(t('common.error', 'Error'), t('rules.drlRequired', 'DRL content is required for testing'));
      return;
    }
    navigation.navigate('RuleTest', {
      ruleId: ruleId,
      drlContent,
      ruleName,
    });
  };

  const isEnglish = i18n.language?.startsWith('en');

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1890ff" />
          <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <LinearGradient colors={['#1890ff', '#096dd9']} style={styles.header}>
          <Appbar.Header style={styles.appbar}>
            <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
            <Appbar.Content
              title={isEditMode ? t('rules.editRule', 'Edit Rule') : t('rules.createRule', 'Create Rule')}
              titleStyle={styles.headerTitle}
            />
            {isEditMode && (
              <Appbar.Action icon="delete" color="#fff" onPress={() => {
                Alert.alert(
                  t('rules.deleteConfirm', 'Delete Rule'),
                  t('rules.deleteConfirmMessage', 'Are you sure you want to delete this rule?'),
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    {
                      text: t('common.delete', 'Delete'),
                      style: 'destructive',
                      onPress: async () => {
                        if (factoryId && ruleId) {
                          try {
                            await ruleConfigApiClient.deleteRule(factoryId, ruleId);
                            navigation.goBack();
                          } catch (error) {
                            Alert.alert(t('common.error', 'Error'), t('rules.deleteFailed', 'Failed to delete rule'));
                          }
                        }
                      },
                    },
                  ]
                );
              }} />
            )}
          </Appbar.Header>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Creation Method Selection (only for create mode) */}
          {!isEditMode && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>{t('rules.creationMethod', 'Creation Method')}</Text>
                <View style={styles.methodGrid}>
                  <TouchableOpacity
                    style={[
                      styles.methodCard,
                      creationMethod === 'manual' && styles.methodCardActive,
                    ]}
                    onPress={() => setCreationMethod('manual')}
                  >
                    <IconButton icon="pencil" size={32} iconColor={creationMethod === 'manual' ? '#1890ff' : '#666'} />
                    <Text style={[styles.methodTitle, creationMethod === 'manual' && styles.methodTitleActive]}>
                      {t('rules.manualWrite', 'Manual Write')}
                    </Text>
                    <Text style={styles.methodDesc}>
                      {t('rules.manualWriteDesc', 'Write DRL code directly')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.methodCard,
                      creationMethod === 'ai' && styles.methodCardActive,
                    ]}
                    onPress={() => setCreationMethod('ai')}
                  >
                    <IconButton icon="robot" size={32} iconColor={creationMethod === 'ai' ? '#1890ff' : '#666'} />
                    <Text style={[styles.methodTitle, creationMethod === 'ai' && styles.methodTitleActive]}>
                      {t('rules.aiAssisted', 'AI Assisted')}
                    </Text>
                    <Text style={styles.methodDesc}>
                      {t('rules.aiAssistedDesc', 'Describe in natural language')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* AI Prompt Input (if AI method selected) */}
          {creationMethod === 'ai' && !isEditMode && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>{t('rules.describeRule', 'Describe Your Rule')}</Text>
                <TextInput
                  mode="outlined"
                  placeholder={t('rules.aiPromptPlaceholder', 'e.g., When material batch quantity is less than 100, trigger low stock alert')}
                  value={aiPrompt}
                  onChangeText={setAiPrompt}
                  multiline
                  numberOfLines={4}
                  style={styles.aiPromptInput}
                />
                <Button
                  mode="contained"
                  icon="auto-fix"
                  onPress={generateWithAI}
                  loading={aiGenerating}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  style={styles.generateButton}
                >
                  {t('rules.generateDRL', 'Generate DRL')}
                </Button>
              </Card.Content>
            </Card>
          )}

          {/* Basic Info */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>{t('rules.basicInfo', 'Basic Information')}</Text>

              <TextInput
                mode="outlined"
                label={t('rules.ruleName', 'Rule Name') + ' *'}
                value={ruleName}
                onChangeText={setRuleName}
                placeholder={t('rules.ruleNamePlaceholder', 'Enter rule name')}
                style={styles.input}
              />

              <TextInput
                mode="outlined"
                label={t('rules.ruleId', 'Rule ID') + ' *'}
                value={ruleIdInput}
                onChangeText={setRuleIdInput}
                placeholder="RULE-VAL-001"
                right={<TextInput.Icon icon="refresh" onPress={() => setRuleIdInput(generateRuleId())} />}
                style={styles.input}
                disabled={isEditMode}
              />

              {/* Rule Group Dropdown */}
              <View style={styles.dropdownContainer}>
                <Text style={styles.inputLabel}>{t('rules.ruleGroup', 'Rule Group')} *</Text>
                <Menu
                  visible={groupMenuVisible}
                  onDismiss={() => setGroupMenuVisible(false)}
                  anchor={
                    <TouchableOpacity
                      style={styles.dropdown}
                      onPress={() => setGroupMenuVisible(true)}
                    >
                      <Chip
                        icon={getGroupConfig(ruleGroup).icon}
                        style={[styles.groupChip, { backgroundColor: getGroupConfig(ruleGroup).color + '20' }]}
                        textStyle={{ color: getGroupConfig(ruleGroup).color }}
                      >
                        {isEnglish ? getGroupConfig(ruleGroup).labelEn : getGroupConfig(ruleGroup).label}
                      </Chip>
                      <IconButton icon="chevron-down" size={20} />
                    </TouchableOpacity>
                  }
                >
                  {RULE_GROUPS.map(group => (
                    <Menu.Item
                      key={group.key}
                      onPress={() => handleGroupSelect(group.key)}
                      title={isEnglish ? group.labelEn : group.label}
                      leadingIcon={group.icon}
                    />
                  ))}
                </Menu>
              </View>

              {/* Priority Slider */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.inputLabel}>{t('rules.priority', 'Priority (Salience)')}</Text>
                  <Text style={styles.priorityValue}>{priority}</Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={100}
                  step={1}
                  value={priority}
                  onValueChange={setPriority}
                  minimumTrackTintColor="#1890ff"
                  maximumTrackTintColor="#ddd"
                  thumbTintColor="#1890ff"
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>{t('rules.lowPriority', 'Low')}</Text>
                  <Text style={styles.sliderLabel}>{t('rules.highPriority', 'High')}</Text>
                </View>
                <Text style={styles.helperText}>
                  {t('rules.priorityHelp', 'Higher values mean the rule executes first')}
                </Text>
              </View>

              <TextInput
                mode="outlined"
                label={t('rules.description', 'Description')}
                value={description}
                onChangeText={setDescription}
                placeholder={t('rules.descriptionPlaceholder', 'Enter rule description')}
                multiline
                numberOfLines={3}
                style={styles.input}
              />
            </Card.Content>
          </Card>

          {/* DRL Code Editor */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.editorHeader}>
                <Text style={styles.sectionTitle}>{t('rules.drlEditor', 'DRL Code Editor')}</Text>
                <View style={styles.editorTags}>
                  <Chip compact style={styles.editorTag}>DRL</Chip>
                  <Chip compact style={styles.editorTag}>Drools 7.x</Chip>
                </View>
                <View style={styles.editorActions}>
                  <IconButton
                    icon="content-copy"
                    size={20}
                    onPress={() => {
                      // Copy to clipboard (would need expo-clipboard)
                      Alert.alert(t('common.copied', 'Copied'));
                    }}
                  />
                  <IconButton
                    icon="check-circle"
                    size={20}
                    onPress={validateDRL}
                    disabled={validating}
                  />
                </View>
              </View>

              <View style={styles.codeEditorContainer}>
                <RNTextInput
                  style={styles.codeEditor}
                  value={drlContent}
                  onChangeText={setDrlContent}
                  multiline
                  placeholder={DRL_TEMPLATE}
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </View>

              {validationResult && (
                <View style={[styles.validationResult, !validationResult.valid && styles.validationError]}>
                  <IconButton
                    icon={validationResult.valid ? 'check-circle' : 'alert-circle'}
                    iconColor={validationResult.valid ? '#52c41a' : '#f5222d'}
                    size={20}
                  />
                  <Text style={[styles.validationText, !validationResult.valid && styles.validationErrorText]}>
                    {validationResult.valid
                      ? t('rules.syntaxValid', 'Syntax is valid')
                      : validationResult.errors[0]}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Condition Builder (Visual) */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>{t('rules.conditionBuilder', 'Condition Builder')}</Text>
              <Text style={styles.sectionSubtitle}>
                {t('rules.conditionBuilderDesc', 'Visually build conditions (optional)')}
              </Text>

              {/* When Section */}
              <View style={styles.builderSection}>
                <View style={styles.builderHeader}>
                  <View style={styles.whenBadge}>
                    <Text style={styles.whenBadgeText}>WHEN</Text>
                  </View>
                </View>

                {conditions.map((condition, index) => (
                  <View key={condition.id} style={styles.conditionRow}>
                    <View style={styles.conditionFields}>
                      <Menu
                        visible={false}
                        onDismiss={() => {}}
                        anchor={
                          <Chip compact onPress={() => {}} style={styles.conditionChip}>
                            {condition.entity}
                          </Chip>
                        }
                      >
                        {ENTITY_TYPES.map(et => (
                          <Menu.Item
                            key={et.key}
                            onPress={() => updateCondition(condition.id, { entity: et.key })}
                            title={isEnglish ? et.labelEn : et.label}
                          />
                        ))}
                      </Menu>

                      <TextInput
                        mode="outlined"
                        dense
                        placeholder={t('rules.field', 'Field')}
                        value={condition.field}
                        onChangeText={v => updateCondition(condition.id, { field: v })}
                        style={styles.conditionInput}
                      />

                      <Menu
                        visible={false}
                        onDismiss={() => {}}
                        anchor={
                          <Chip compact onPress={() => {}} style={styles.operatorChip}>
                            {condition.operator}
                          </Chip>
                        }
                      >
                        {OPERATORS.map(op => (
                          <Menu.Item
                            key={op.key}
                            onPress={() => updateCondition(condition.id, { operator: op.key })}
                            title={op.label}
                          />
                        ))}
                      </Menu>

                      <TextInput
                        mode="outlined"
                        dense
                        placeholder={t('rules.value', 'Value')}
                        value={condition.value}
                        onChangeText={v => updateCondition(condition.id, { value: v })}
                        style={styles.conditionInput}
                      />
                    </View>
                    <IconButton
                      icon="close"
                      size={20}
                      onPress={() => removeCondition(condition.id)}
                    />
                  </View>
                ))}

                <TouchableOpacity style={styles.addButton} onPress={addCondition}>
                  <IconButton icon="plus" size={16} iconColor="#1890ff" />
                  <Text style={styles.addButtonText}>{t('rules.addCondition', 'Add Condition')}</Text>
                </TouchableOpacity>
              </View>

              <Divider style={styles.builderDivider} />

              {/* Then Section */}
              <View style={styles.builderSection}>
                <View style={styles.builderHeader}>
                  <View style={styles.thenBadge}>
                    <Text style={styles.thenBadgeText}>THEN</Text>
                  </View>
                </View>

                {actions.map((action, index) => (
                  <View key={action.id} style={styles.actionRow}>
                    <View style={styles.actionFields}>
                      <Menu
                        visible={false}
                        onDismiss={() => {}}
                        anchor={
                          <Chip compact onPress={() => {}} style={styles.actionChip}>
                            {ACTION_TYPES.find(a => a.key === action.type)?.label || action.type}
                          </Chip>
                        }
                      >
                        {ACTION_TYPES.map(at => (
                          <Menu.Item
                            key={at.key}
                            onPress={() => updateAction(action.id, { type: at.key })}
                            title={isEnglish ? at.labelEn : at.label}
                          />
                        ))}
                      </Menu>

                      <TextInput
                        mode="outlined"
                        dense
                        placeholder={t('rules.target', 'Target')}
                        value={action.target}
                        onChangeText={v => updateAction(action.id, { target: v })}
                        style={styles.actionInput}
                      />

                      <TextInput
                        mode="outlined"
                        dense
                        placeholder={t('rules.value', 'Value')}
                        value={action.value}
                        onChangeText={v => updateAction(action.id, { value: v })}
                        style={styles.actionInput}
                      />
                    </View>
                    <IconButton
                      icon="close"
                      size={20}
                      onPress={() => removeAction(action.id)}
                    />
                  </View>
                ))}

                <TouchableOpacity style={styles.addButton} onPress={addAction}>
                  <IconButton icon="plus" size={16} iconColor="#52c41a" />
                  <Text style={[styles.addButtonText, { color: '#52c41a' }]}>{t('rules.addAction', 'Add Action')}</Text>
                </TouchableOpacity>
              </View>

              {(conditions.length > 0 || actions.length > 0) && (
                <Button
                  mode="outlined"
                  icon="code-tags"
                  onPress={buildDRLFromConditions}
                  style={styles.buildDrlButton}
                >
                  {t('rules.buildDRL', 'Build DRL from Conditions')}
                </Button>
              )}
            </Card.Content>
          </Card>

          {/* Import Dependencies */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.importHeader}>
                <Text style={styles.sectionTitle}>{t('rules.imports', 'Import Dependencies')}</Text>
                <IconButton
                  icon="plus"
                  size={20}
                  onPress={() => setShowImportModal(true)}
                />
              </View>

              <View style={styles.importChips}>
                {imports.map((imp, index) => (
                  <Chip
                    key={index}
                    onClose={() => removeImport(imp)}
                    style={styles.importChip}
                    textStyle={styles.importChipText}
                  >
                    {imp.split('.').pop()}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>

          {/* Advanced Settings */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>{t('rules.advancedSettings', 'Advanced Settings')}</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{t('rules.enableImmediately', 'Enable Immediately')}</Text>
                  <Text style={styles.settingDesc}>
                    {t('rules.enableImmediatelyDesc', 'Rule will be active right after saving')}
                  </Text>
                </View>
                <Switch
                  value={enabledImmediately}
                  onValueChange={setEnabledImmediately}
                  color="#1890ff"
                />
              </View>

              <Divider style={styles.settingDivider} />

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{t('rules.logExecution', 'Log Execution')}</Text>
                  <Text style={styles.settingDesc}>
                    {t('rules.logExecutionDesc', 'Record rule execution in audit log')}
                  </Text>
                </View>
                <Switch
                  value={logExecution}
                  onValueChange={setLogExecution}
                  color="#1890ff"
                />
              </View>

              <Divider style={styles.settingDivider} />

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{t('rules.interruptOnFailure', 'Interrupt on Failure')}</Text>
                  <Text style={styles.settingDesc}>
                    {t('rules.interruptOnFailureDesc', 'Stop workflow if rule execution fails')}
                  </Text>
                </View>
                <Switch
                  value={interruptOnFailure}
                  onValueChange={setInterruptOnFailure}
                  color="#1890ff"
                />
              </View>
            </Card.Content>
          </Card>

          {/* Bottom spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.actionBar}>
          <Button
            mode="outlined"
            icon="play-circle"
            onPress={handleTest}
            style={styles.testButton}
            disabled={saving}
          >
            {t('rules.testRule', 'Test Rule')}
          </Button>
          <Button
            mode="contained"
            icon="content-save"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
          >
            {isEditMode ? t('rules.updateRule', 'Update Rule') : t('rules.saveRule', 'Save Rule')}
          </Button>
        </View>

        {/* Import Modal */}
        <Portal>
          <Modal
            visible={showImportModal}
            onDismiss={() => setShowImportModal(false)}
            contentContainerStyle={styles.modal}
          >
            <Text style={styles.modalTitle}>{t('rules.addImport', 'Add Import')}</Text>
            <TextInput
              mode="outlined"
              label={t('rules.className', 'Class Name')}
              value={newImport}
              onChangeText={setNewImport}
              placeholder="com.cretas.aims.entity.ClassName"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Button mode="text" onPress={() => setShowImportModal(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button mode="contained" onPress={handleAddImport}>
                {t('common.add', 'Add')}
              </Button>
            </View>
          </Modal>
        </Portal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
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
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: -8,
    marginBottom: 12,
  },
  // Method Selection
  methodGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  methodCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e8e8e8',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  methodCardActive: {
    borderColor: '#1890ff',
    backgroundColor: '#e6f7ff',
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 4,
  },
  methodTitleActive: {
    color: '#1890ff',
  },
  methodDesc: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  // AI Prompt
  aiPromptInput: {
    backgroundColor: '#fff',
  },
  generateButton: {
    marginTop: 12,
  },
  // Form
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dropdownContainer: {
    marginBottom: 12,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  groupChip: {
    borderRadius: 16,
  },
  // Priority Slider
  sliderContainer: {
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1890ff',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#999',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  // Code Editor
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  editorTags: {
    flexDirection: 'row',
    marginLeft: 8,
    gap: 4,
  },
  editorTag: {
    backgroundColor: '#333',
    height: 24,
  },
  editorActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  codeEditorContainer: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    minHeight: 200,
  },
  codeEditor: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#d4d4d4',
    lineHeight: 20,
    minHeight: 180,
    textAlignVertical: 'top',
  },
  validationResult: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f6ffed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b7eb8f',
  },
  validationError: {
    backgroundColor: '#fff2f0',
    borderColor: '#ffccc7',
  },
  validationText: {
    color: '#52c41a',
    fontSize: 13,
    flex: 1,
  },
  validationErrorText: {
    color: '#f5222d',
  },
  // Condition Builder
  builderSection: {
    marginVertical: 8,
  },
  builderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  whenBadge: {
    backgroundColor: '#1890ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  whenBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  thenBadge: {
    backgroundColor: '#52c41a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  thenBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#fafafa',
    padding: 8,
    borderRadius: 8,
  },
  conditionFields: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  conditionChip: {
    backgroundColor: '#e6f7ff',
  },
  operatorChip: {
    backgroundColor: '#fff7e6',
  },
  conditionInput: {
    flex: 1,
    minWidth: 80,
    height: 36,
    backgroundColor: '#fff',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#fafafa',
    padding: 8,
    borderRadius: 8,
  },
  actionFields: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  actionChip: {
    backgroundColor: '#f6ffed',
  },
  actionInput: {
    flex: 1,
    minWidth: 80,
    height: 36,
    backgroundColor: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#1890ff',
    fontSize: 14,
  },
  builderDivider: {
    marginVertical: 16,
  },
  buildDrlButton: {
    marginTop: 16,
  },
  // Imports
  importHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  importChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  importChip: {
    backgroundColor: '#f0f0f0',
  },
  importChipText: {
    fontSize: 12,
  },
  // Settings
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  settingDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  settingDivider: {
    marginVertical: 8,
  },
  // Bottom
  bottomSpacing: {
    height: 80,
  },
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
  saveButton: {
    flex: 2,
  },
  // Modal
  modal: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
