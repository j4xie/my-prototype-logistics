import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Share,
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
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../../store/authStore';
import { ruleConfigApiClient, DroolsRule, RuleGroup } from '../../../services/api/ruleConfigApiClient';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('DrlPreviewScreen');

// Route params type
type DrlPreviewRouteParams = {
  DrlPreview: {
    ruleId?: string;
    drlContent?: string;
    ruleName?: string;
    ruleGroup?: RuleGroup;
  };
};

// Syntax highlighting colors
const SYNTAX_COLORS = {
  keyword: '#569cd6',
  type: '#4ec9b0',
  string: '#ce9178',
  comment: '#6a9955',
  operator: '#d4d4d4',
  number: '#b5cea8',
};

const DrlPreviewScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object>>>();
  const route = useRoute<RouteProp<DrlPreviewRouteParams, 'DrlPreview'>>();
  const { getFactoryId } = useAuthStore();
  const factoryId = getFactoryId();

  const {
    ruleId,
    drlContent: initialDrlContent,
    ruleName: initialRuleName,
    ruleGroup: initialRuleGroup,
  } = route.params || {};

  // State
  const [loading, setLoading] = useState(false);
  const [rule, setRule] = useState<DroolsRule | null>(null);
  const [drlContent, setDrlContent] = useState(initialDrlContent || '');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wrapLines, setWrapLines] = useState(false);

  // Load rule if ruleId is provided
  useEffect(() => {
    if (ruleId && factoryId) {
      loadRule();
    }
  }, [ruleId, factoryId]);

  const loadRule = async () => {
    if (!ruleId || !factoryId) return;

    try {
      setLoading(true);
      const response = await ruleConfigApiClient.getRuleById(ruleId, factoryId);
      if (response) {
        setRule(response);
        setDrlContent(response.ruleContent || '');
      }
    } catch (error) {
      logger.error('Failed to load rule', error);
      Alert.alert(t('common.error'), t('rules.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(drlContent);
      Alert.alert(t('common.success'), t('common.copied'));
    } catch (error) {
      logger.error('Failed to copy content', error);
    }
  };

  // Export DRL file
  const handleExport = async () => {
    try {
      const fileName = `${rule?.ruleName || initialRuleName || 'rule'}.drl`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, drlContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: t('rules.exportDrl', 'Export DRL File'),
        });
      } else {
        // Use native share if expo-sharing is not available
        await Share.share({
          title: fileName,
          message: drlContent,
        });
      }
    } catch (error) {
      logger.error('Failed to export file', error);
      Alert.alert(t('common.error'), t('rules.exportFailed'));
    }
  };

  // Navigate to editor
  const handleEdit = () => {
    navigation.navigate('DrlCodeEditor', {
      ruleId,
      initialDrl: drlContent,
      ruleName: rule?.ruleName || initialRuleName,
      ruleGroup: rule?.ruleGroup || initialRuleGroup,
    });
  };

  // Get rule group config
  const getRuleGroupConfig = (group: RuleGroup) => {
    const configs: Record<RuleGroup, { label: string; labelZh: string; color: string; icon: string }> = {
      validation: { label: 'Validation', labelZh: '验证规则', color: '#1890ff', icon: 'check-circle' },
      workflow: { label: 'Workflow', labelZh: '工作流', color: '#52c41a', icon: 'sitemap' },
      quality: { label: 'Quality', labelZh: '质检', color: '#722ed1', icon: 'shield-check' },
      costing: { label: 'Costing', labelZh: '成本', color: '#fa8c16', icon: 'currency-usd' },
      alert: { label: 'Alert', labelZh: '告警', color: '#f5222d', icon: 'alert' },
    };
    return configs[group] || configs.validation;
  };

  // Parse and highlight DRL content
  const renderHighlightedCode = useCallback(() => {
    if (!drlContent) return null;

    const lines = drlContent.split('\n');
    const keywords = ['package', 'import', 'rule', 'when', 'then', 'end', 'salience', 'no-loop', 'lock-on-active'];
    const types = ['String', 'Integer', 'Long', 'Double', 'Boolean', 'Date', 'LocalDate', 'LocalDateTime'];

    return lines.map((line, lineIndex) => {
      const trimmedLine = line.trim();
      let highlightedLine = line;
      let lineColor = '#d4d4d4';

      // Check if it's a comment
      if (trimmedLine.startsWith('//')) {
        lineColor = SYNTAX_COLORS.comment;
      }

      return (
        <View key={lineIndex} style={styles.codeLine}>
          {showLineNumbers && (
            <Text style={styles.lineNumber}>{lineIndex + 1}</Text>
          )}
          <Text
            style={[
              styles.codeText,
              { color: lineColor },
              wrapLines && styles.codeTextWrap,
            ]}
          >
            {renderColorizedLine(line, keywords, types)}
          </Text>
        </View>
      );
    });
  }, [drlContent, showLineNumbers, wrapLines]);

  // Colorize a single line
  const renderColorizedLine = (line: string, keywords: string[], types: string[]) => {
    // Simple tokenization for syntax highlighting
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    // Check for comment first
    if (remaining.trim().startsWith('//')) {
      return (
        <Text key={key} style={{ color: SYNTAX_COLORS.comment }}>
          {line}
        </Text>
      );
    }

    // Check for string literals
    const stringMatch = remaining.match(/"([^"]*)"/);
    if (stringMatch) {
      const index = remaining.indexOf(stringMatch[0]);
      if (index > 0) {
        tokens.push(
          <Text key={key++}>{remaining.substring(0, index)}</Text>
        );
      }
      tokens.push(
        <Text key={key++} style={{ color: SYNTAX_COLORS.string }}>
          {stringMatch[0]}
        </Text>
      );
      remaining = remaining.substring(index + stringMatch[0].length);
    }

    // Check for keywords
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      if (regex.test(remaining)) {
        const parts = remaining.split(regex);
        const newTokens: React.ReactNode[] = [];
        parts.forEach((part, i) => {
          if (part) newTokens.push(<Text key={key++}>{part}</Text>);
          if (i < parts.length - 1) {
            newTokens.push(
              <Text key={key++} style={{ color: SYNTAX_COLORS.keyword }}>
                {keyword}
              </Text>
            );
          }
        });
        if (newTokens.length > 0) {
          tokens.push(...newTokens);
          remaining = '';
          break;
        }
      }
    }

    if (remaining) {
      tokens.push(<Text key={key++}>{remaining}</Text>);
    }

    return tokens.length > 0 ? tokens : line;
  };

  // Parse rule documentation from DRL content
  const parseDocumentation = useCallback(() => {
    if (!drlContent) return null;

    const docs: { title: string; content: string }[] = [];

    // Extract package
    const packageMatch = drlContent.match(/package\s+([\w.]+)/);
    if (packageMatch?.[1]) {
      docs.push({ title: t('rules.package', 'Package'), content: packageMatch[1] });
    }

    // Extract rule names
    const ruleMatches = drlContent.matchAll(/rule\s+"([^"]+)"/g);
    const ruleNames = Array.from(ruleMatches).map((m) => m[1]).filter((name): name is string => !!name);
    if (ruleNames.length > 0) {
      docs.push({ title: t('rules.rulesInFile', 'Rules in File'), content: ruleNames.join(', ') });
    }

    // Extract imports
    const importMatches = drlContent.matchAll(/import\s+([\w.]+)/g);
    const imports = Array.from(importMatches)
      .map((m) => m[1]?.split('.').pop())
      .filter((name): name is string => !!name);
    if (imports.length > 0) {
      docs.push({ title: t('rules.imports', 'Imports'), content: imports.join(', ') });
    }

    // Extract salience
    const salienceMatch = drlContent.match(/salience\s+(\d+)/);
    if (salienceMatch?.[1]) {
      docs.push({ title: t('rules.priority', 'Priority (Salience)'), content: salienceMatch[1] });
    }

    return docs;
  }, [drlContent, t]);

  const groupConfig = getRuleGroupConfig(rule?.ruleGroup || initialRuleGroup || 'validation');
  const documentation = parseDocumentation();

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#722ed1', '#531dab']} style={styles.header}>
        <Appbar.Header style={styles.appbar}>
          <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
          <Appbar.Content
            title={t('rules.drlPreview', 'DRL Preview')}
            titleStyle={styles.headerTitle}
          />
          <Appbar.Action icon="content-copy" color="#fff" onPress={handleCopy} />
          <Appbar.Action icon="export" color="#fff" onPress={handleExport} />
        </Appbar.Header>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Rule Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoHeader}>
              <Avatar.Icon
                size={48}
                icon={groupConfig.icon}
                color="#fff"
                style={{ backgroundColor: groupConfig.color }}
              />
              <View style={styles.infoContent}>
                <Text style={styles.ruleName}>
                  {rule?.ruleName || initialRuleName || t('rules.untitled', 'Untitled Rule')}
                </Text>
                <View style={styles.infoMeta}>
                  <Chip
                    compact
                    style={[styles.groupChip, { backgroundColor: groupConfig.color + '20' }]}
                    textStyle={{ color: groupConfig.color }}
                  >
                    {i18n.language === 'en' ? groupConfig.label : groupConfig.labelZh}
                  </Chip>
                  {rule && (
                    <Text style={styles.versionText}>v{rule.version}</Text>
                  )}
                </View>
              </View>
            </View>

            {rule?.ruleDescription && (
              <View style={styles.description}>
                <Text style={styles.descriptionText}>{rule.ruleDescription}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* View Options */}
        <View style={styles.viewOptions}>
          <TouchableOpacity
            style={[styles.optionButton, showLineNumbers && styles.optionButtonActive]}
            onPress={() => setShowLineNumbers(!showLineNumbers)}
          >
            <IconButton
              icon="format-list-numbered"
              size={16}
              iconColor={showLineNumbers ? '#1890ff' : '#666'}
            />
            <Text style={[styles.optionText, showLineNumbers && styles.optionTextActive]}>
              {t('rules.lineNumbers', 'Line Numbers')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, wrapLines && styles.optionButtonActive]}
            onPress={() => setWrapLines(!wrapLines)}
          >
            <IconButton
              icon="wrap"
              size={16}
              iconColor={wrapLines ? '#1890ff' : '#666'}
            />
            <Text style={[styles.optionText, wrapLines && styles.optionTextActive]}>
              {t('rules.wrapLines', 'Wrap Lines')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Code Preview */}
        <Card style={styles.codeCard}>
          <Card.Content style={styles.codeContent}>
            <View style={styles.codeHeader}>
              <View style={styles.codeTags}>
                <Chip compact style={styles.codeTag}>DRL</Chip>
                <Chip compact style={styles.codeTag}>Read Only</Chip>
              </View>
              <Text style={styles.lineCount}>
                {drlContent.split('\n').length} {t('rules.lines', 'lines')}
              </Text>
            </View>

            <ScrollView
              horizontal={!wrapLines}
              showsHorizontalScrollIndicator={!wrapLines}
              style={styles.codeScroll}
            >
              <View style={styles.codeContainer}>
                {renderHighlightedCode()}
              </View>
            </ScrollView>
          </Card.Content>
        </Card>

        {/* Documentation */}
        {documentation && documentation.length > 0 && (
          <Card style={styles.docCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>
                {t('rules.documentation', 'Rule Documentation')}
              </Text>
              {documentation.map((doc, index) => (
                <View key={index} style={styles.docItem}>
                  <Text style={styles.docTitle}>{doc.title}</Text>
                  <Text style={styles.docContent}>{doc.content}</Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Syntax Legend */}
        <Card style={styles.legendCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>
              {t('rules.syntaxLegend', 'Syntax Legend')}
            </Text>
            <View style={styles.legendGrid}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: SYNTAX_COLORS.keyword }]} />
                <Text style={styles.legendText}>{t('rules.keywords', 'Keywords')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: SYNTAX_COLORS.type }]} />
                <Text style={styles.legendText}>{t('rules.types', 'Types')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: SYNTAX_COLORS.string }]} />
                <Text style={styles.legendText}>{t('rules.strings', 'Strings')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: SYNTAX_COLORS.comment }]} />
                <Text style={styles.legendText}>{t('rules.comments', 'Comments')}</Text>
              </View>
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
          icon="export"
          onPress={handleExport}
          style={styles.exportButton}
        >
          {t('rules.export', 'Export')}
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
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: 16,
  },
  ruleName: {
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
  groupChip: {
    borderRadius: 16,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
  description: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // View Options
  viewOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  optionButtonActive: {
    borderColor: '#1890ff',
    backgroundColor: '#e6f7ff',
  },
  optionText: {
    fontSize: 12,
    color: '#666',
  },
  optionTextActive: {
    color: '#1890ff',
  },
  // Code Card
  codeCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  codeContent: {
    padding: 0,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  codeTags: {
    flexDirection: 'row',
    gap: 8,
  },
  codeTag: {
    backgroundColor: '#333',
    height: 24,
  },
  lineCount: {
    fontSize: 12,
    color: '#999',
  },
  codeScroll: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    margin: 12,
    maxHeight: 400,
  },
  codeContainer: {
    padding: 12,
  },
  codeLine: {
    flexDirection: 'row',
    minHeight: 20,
  },
  lineNumber: {
    width: 32,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 20,
    color: '#666',
    textAlign: 'right',
    paddingRight: 12,
    marginRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 20,
    color: '#d4d4d4',
  },
  codeTextWrap: {
    flex: 1,
    flexWrap: 'wrap',
  },
  // Documentation Card
  docCard: {
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
  docItem: {
    marginBottom: 12,
  },
  docTitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  docContent: {
    fontSize: 14,
    color: '#333',
  },
  // Legend Card
  legendCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
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
  exportButton: {
    flex: 1,
  },
  editButton: {
    flex: 2,
    backgroundColor: '#722ed1',
  },
  bottomSpacing: {
    height: 80,
  },
});

export default DrlPreviewScreen;
