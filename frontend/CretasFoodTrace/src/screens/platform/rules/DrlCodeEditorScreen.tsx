import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput as RNTextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
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
  Portal,
  Modal,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../../store/authStore';
import { ruleConfigApiClient, DroolsRule, RuleGroup, RuleValidationResult } from '../../../services/api/ruleConfigApiClient';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('DrlCodeEditorScreen');

// Route params type
type DrlCodeEditorRouteParams = {
  DrlCodeEditor: {
    ruleId?: string;
    initialDrl?: string;
    ruleName?: string;
    ruleGroup?: RuleGroup;
  };
};

// DRL template
const DRL_TEMPLATE = `package com.cretas.rules

import com.cretas.aims.entity.MaterialBatch
import java.time.LocalDate
import java.time.LocalDateTime

rule "RuleName"
    salience 50
    when
        $batch : MaterialBatch(
            // Add conditions here
        )
    then
        // Add actions here
end`;

// Syntax highlighting keywords
const DRL_KEYWORDS = [
  'package', 'import', 'rule', 'when', 'then', 'end',
  'salience', 'no-loop', 'lock-on-active', 'date-effective',
  'date-expires', 'dialect', 'agenda-group', 'activation-group',
];

const DRL_TYPES = [
  'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean',
  'Date', 'LocalDate', 'LocalDateTime', 'List', 'Map', 'Set',
];

const DrlCodeEditorScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object>>>();
  const route = useRoute<RouteProp<DrlCodeEditorRouteParams, 'DrlCodeEditor'>>();
  const { getFactoryId } = useAuthStore();
  const factoryId = getFactoryId();

  const { ruleId, initialDrl, ruleName: initialRuleName, ruleGroup: initialRuleGroup } = route.params || {};

  // State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [drlContent, setDrlContent] = useState(initialDrl || DRL_TEMPLATE);
  const [rule, setRule] = useState<DroolsRule | null>(null);

  // Metadata state
  const [ruleName, setRuleName] = useState(initialRuleName || '');
  const [ruleGroup, setRuleGroup] = useState<RuleGroup>(initialRuleGroup || 'validation');
  const [version, setVersion] = useState('1.0.0');
  const [showMetadataModal, setShowMetadataModal] = useState(false);

  // Validation state
  const [validationResult, setValidationResult] = useState<RuleValidationResult | null>(null);

  // Line numbers
  const [lineCount, setLineCount] = useState(1);

  // Load rule if ruleId is provided
  useEffect(() => {
    if (ruleId && factoryId) {
      loadRule();
    }
  }, [ruleId, factoryId]);

  // Update line count when content changes
  useEffect(() => {
    const lines = drlContent.split('\n').length;
    setLineCount(lines);
  }, [drlContent]);

  const loadRule = async () => {
    if (!ruleId || !factoryId) return;

    try {
      setLoading(true);
      const response = await ruleConfigApiClient.getRuleById(ruleId, factoryId);
      if (response) {
        setRule(response);
        setDrlContent(response.ruleContent || DRL_TEMPLATE);
        setRuleName(response.ruleName);
        setRuleGroup(response.ruleGroup);
        setVersion(String(response.version || '1.0.0'));
      }
    } catch (error) {
      logger.error('Failed to load rule', error);
      Alert.alert(t('common.error'), t('rules.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Validate DRL syntax
  const handleValidate = async () => {
    if (!factoryId) return;

    try {
      setValidating(true);
      setValidationResult(null);

      const result = await ruleConfigApiClient.validateDRL(drlContent, factoryId);
      setValidationResult(result);

      if (result.isValid) {
        Alert.alert(
          t('rules.validationSuccess', 'Validation Successful'),
          t('rules.drlValid', 'DRL syntax is valid')
        );
      }
    } catch (error) {
      logger.error('DRL validation failed', error);
      setValidationResult({
        isValid: false,
        errors: [t('rules.validationError', 'Validation failed')],
        warnings: [],
      });
    } finally {
      setValidating(false);
    }
  };

  // Save DRL content
  const handleSave = async () => {
    if (!factoryId) {
      Alert.alert(t('common.error'), t('rules.noFactory'));
      return;
    }

    if (!ruleName.trim()) {
      Alert.alert(t('common.error'), t('rules.nameRequired'));
      return;
    }

    try {
      setSaving(true);

      if (ruleId && rule) {
        // Update existing rule
        await ruleConfigApiClient.updateRule(ruleId, {
          ruleName,
          ruleContent: drlContent,
          ruleDescription: rule.ruleDescription,
          priority: rule.priority,
        }, factoryId);
        Alert.alert(t('common.success'), t('rules.updateSuccess'), [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Create new rule
        await ruleConfigApiClient.createRule({
          ruleGroup,
          ruleName,
          ruleContent: drlContent,
          ruleDescription: '',
          priority: 50,
          enabled: true,
        }, factoryId);
        Alert.alert(t('common.success'), t('rules.createSuccess'), [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      logger.error('Failed to save rule', error);
      Alert.alert(t('common.error'), t('rules.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Copy content to clipboard
  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(drlContent);
      Alert.alert(t('common.success'), t('common.copied'));
    } catch (error) {
      logger.error('Failed to copy content', error);
    }
  };

  // Clear content
  const handleClear = () => {
    Alert.alert(
      t('rules.clearConfirm', 'Clear Content'),
      t('rules.clearMessage', 'Are you sure you want to clear all content?'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => setDrlContent(DRL_TEMPLATE),
        },
      ]
    );
  };

  // Format DRL (basic indentation)
  const handleFormat = () => {
    const lines = drlContent.split('\n');
    let indentLevel = 0;
    const formattedLines = lines.map((line) => {
      const trimmedLine = line.trim();

      // Decrease indent for 'end', 'then'
      if (trimmedLine.startsWith('end') || trimmedLine.startsWith('then')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const indent = '    '.repeat(indentLevel);
      const formattedLine = indent + trimmedLine;

      // Increase indent after 'rule', 'when', 'then'
      if (trimmedLine.startsWith('rule') || trimmedLine.startsWith('when')) {
        indentLevel++;
      }

      return formattedLine;
    });

    setDrlContent(formattedLines.join('\n'));
  };

  // Insert snippet
  const insertSnippet = (snippet: string) => {
    setDrlContent((prev) => prev + '\n' + snippet);
  };

  // Render line numbers
  const renderLineNumbers = () => {
    const lines = [];
    for (let i = 1; i <= lineCount; i++) {
      lines.push(
        <Text key={i} style={styles.lineNumber}>
          {i}
        </Text>
      );
    }
    return lines;
  };

  // Get rule group config
  const getRuleGroupConfig = (group: RuleGroup) => {
    const configs: Record<RuleGroup, { label: string; color: string; icon: string }> = {
      validation: { label: 'Validation', color: '#1890ff', icon: 'check-circle' },
      workflow: { label: 'Workflow', color: '#52c41a', icon: 'sitemap' },
      quality: { label: 'Quality', color: '#722ed1', icon: 'shield-check' },
      costing: { label: 'Costing', color: '#fa8c16', icon: 'currency-usd' },
      alert: { label: 'Alert', color: '#f5222d', icon: 'alert' },
    };
    return configs[group] || configs.validation;
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

  const groupConfig = getRuleGroupConfig(ruleGroup);

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
              title={t('rules.drlEditor', 'DRL Code Editor')}
              titleStyle={styles.headerTitle}
            />
            <Appbar.Action icon="content-copy" color="#fff" onPress={handleCopy} />
            <Appbar.Action icon="format-align-left" color="#fff" onPress={handleFormat} />
          </Appbar.Header>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Rule Metadata Card */}
          <Card style={styles.metadataCard}>
            <Card.Content>
              <TouchableOpacity
                style={styles.metadataHeader}
                onPress={() => setShowMetadataModal(true)}
              >
                <View style={styles.metadataInfo}>
                  <Text style={styles.metadataName} numberOfLines={1}>
                    {ruleName || t('rules.untitled', 'Untitled Rule')}
                  </Text>
                  <View style={styles.metadataChips}>
                    <Chip
                      compact
                      icon={groupConfig.icon}
                      style={[styles.groupChip, { backgroundColor: groupConfig.color + '20' }]}
                      textStyle={{ color: groupConfig.color }}
                    >
                      {groupConfig.label}
                    </Chip>
                    <Chip compact style={styles.versionChip}>
                      v{version}
                    </Chip>
                  </View>
                </View>
                <IconButton icon="pencil" size={20} />
              </TouchableOpacity>
            </Card.Content>
          </Card>

          {/* Toolbar */}
          <View style={styles.toolbar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Chip
                compact
                style={styles.toolbarChip}
                icon="check-circle"
                onPress={handleValidate}
              >
                {t('rules.validate', 'Validate')}
              </Chip>
              <Chip
                compact
                style={styles.toolbarChip}
                icon="broom"
                onPress={handleClear}
              >
                {t('rules.clear', 'Clear')}
              </Chip>
              <Chip
                compact
                style={styles.toolbarChip}
                icon="code-tags"
                onPress={() => insertSnippet('\n// Comment')}
              >
                {t('rules.insertComment', 'Comment')}
              </Chip>
              <Chip
                compact
                style={styles.toolbarChip}
                icon="function"
                onPress={() => insertSnippet('\nrule "NewRule"\n    when\n        // condition\n    then\n        // action\nend')}
              >
                {t('rules.insertRule', 'New Rule')}
              </Chip>
            </ScrollView>
          </View>

          {/* Code Editor */}
          <Card style={styles.editorCard}>
            <Card.Content style={styles.editorContent}>
              <View style={styles.editorHeader}>
                <View style={styles.editorTags}>
                  <Chip compact style={styles.editorTag}>DRL</Chip>
                  <Chip compact style={styles.editorTag}>Drools 7.x</Chip>
                </View>
                <Text style={styles.lineCountText}>
                  {lineCount} {t('rules.lines', 'lines')}
                </Text>
              </View>

              <View style={styles.editorWrapper}>
                <View style={styles.lineNumbers}>
                  {renderLineNumbers()}
                </View>
                <RNTextInput
                  style={styles.codeEditor}
                  value={drlContent}
                  onChangeText={setDrlContent}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  placeholder={DRL_TEMPLATE}
                  placeholderTextColor="#666"
                />
              </View>
            </Card.Content>
          </Card>

          {/* Validation Result */}
          {validationResult && (
            <View
              style={[
                styles.validationResult,
                validationResult.isValid ? styles.validationSuccess : styles.validationError,
              ]}
            >
              <IconButton
                icon={validationResult.isValid ? 'check-circle' : 'alert-circle'}
                iconColor={validationResult.isValid ? '#52c41a' : '#f5222d'}
                size={20}
              />
              <View style={styles.validationContent}>
                <Text
                  style={[
                    styles.validationTitle,
                    validationResult.isValid ? styles.validationTitleSuccess : styles.validationTitleError,
                  ]}
                >
                  {validationResult.isValid
                    ? t('rules.syntaxValid', 'Syntax is valid')
                    : t('rules.syntaxInvalid', 'Syntax errors found')}
                </Text>
                {!validationResult.isValid && validationResult.errors.length > 0 && (
                  <Text style={styles.validationErrorText}>
                    {validationResult.errors.join('\n')}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Keywords Reference */}
          <Card style={styles.referenceCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>{t('rules.keywords', 'DRL Keywords')}</Text>
              <View style={styles.keywordsGrid}>
                {DRL_KEYWORDS.map((keyword) => (
                  <TouchableOpacity
                    key={keyword}
                    style={styles.keywordItem}
                    onPress={() => insertSnippet(keyword + ' ')}
                  >
                    <Text style={styles.keywordText}>{keyword}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Divider style={styles.divider} />

              <Text style={styles.sectionTitle}>{t('rules.commonTypes', 'Common Types')}</Text>
              <View style={styles.keywordsGrid}>
                {DRL_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.typeItem}
                    onPress={() => insertSnippet(type + ' ')}
                  >
                    <Text style={styles.typeText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card.Content>
          </Card>

          {/* Bottom spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <Button
            mode="outlined"
            icon="check-circle"
            onPress={handleValidate}
            loading={validating}
            disabled={validating || saving}
            style={styles.validateButton}
          >
            {t('rules.validate', 'Validate')}
          </Button>
          <Button
            mode="contained"
            icon="content-save"
            onPress={handleSave}
            loading={saving}
            disabled={saving || validating}
            style={styles.saveButton}
          >
            {t('common.save', 'Save')}
          </Button>
        </View>

        {/* Metadata Modal */}
        <Portal>
          <Modal
            visible={showMetadataModal}
            onDismiss={() => setShowMetadataModal(false)}
            contentContainerStyle={styles.modal}
          >
            <Text style={styles.modalTitle}>{t('rules.editMetadata', 'Edit Metadata')}</Text>

            <TextInput
              mode="outlined"
              label={t('rules.ruleName', 'Rule Name')}
              value={ruleName}
              onChangeText={setRuleName}
              style={styles.modalInput}
            />

            <TextInput
              mode="outlined"
              label={t('rules.version', 'Version')}
              value={version}
              onChangeText={setVersion}
              style={styles.modalInput}
            />

            <View style={styles.modalActions}>
              <Button mode="text" onPress={() => setShowMetadataModal(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button mode="contained" onPress={() => setShowMetadataModal(false)}>
                {t('common.confirm', 'Confirm')}
              </Button>
            </View>
          </Modal>
        </Portal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

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
    marginTop: 12,
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
  // Metadata Card
  metadataCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  metadataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metadataInfo: {
    flex: 1,
  },
  metadataName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  metadataChips: {
    flexDirection: 'row',
    gap: 8,
  },
  groupChip: {
    borderRadius: 16,
  },
  versionChip: {
    backgroundColor: '#f0f0f0',
  },
  // Toolbar
  toolbar: {
    marginBottom: 12,
  },
  toolbarChip: {
    marginRight: 8,
    backgroundColor: '#fff',
  },
  // Editor Card
  editorCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  editorContent: {
    padding: 0,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  editorTags: {
    flexDirection: 'row',
    gap: 8,
  },
  editorTag: {
    backgroundColor: '#333',
    height: 24,
  },
  lineCountText: {
    fontSize: 12,
    color: '#999',
  },
  editorWrapper: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    minHeight: 300,
    margin: 12,
  },
  lineNumbers: {
    padding: 12,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#333',
    alignItems: 'flex-end',
  },
  lineNumber: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
    color: '#666',
  },
  codeEditor: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
    color: '#d4d4d4',
    padding: 12,
    textAlignVertical: 'top',
  },
  // Validation Result
  validationResult: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  validationSuccess: {
    backgroundColor: '#f6ffed',
    borderWidth: 1,
    borderColor: '#b7eb8f',
  },
  validationError: {
    backgroundColor: '#fff2f0',
    borderWidth: 1,
    borderColor: '#ffccc7',
  },
  validationContent: {
    flex: 1,
    marginLeft: 8,
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  validationTitleSuccess: {
    color: '#52c41a',
  },
  validationTitleError: {
    color: '#f5222d',
  },
  validationErrorText: {
    fontSize: 12,
    color: '#f5222d',
    marginTop: 4,
  },
  // Reference Card
  referenceCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  keywordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordItem: {
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  keywordText: {
    fontSize: 12,
    color: '#1890ff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  typeItem: {
    backgroundColor: '#f6ffed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 12,
    color: '#52c41a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  divider: {
    marginVertical: 16,
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
  validateButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#1890ff',
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
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  bottomSpacing: {
    height: 80,
  },
});

export default DrlCodeEditorScreen;
