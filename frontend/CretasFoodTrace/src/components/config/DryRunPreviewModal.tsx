import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';
import {
  Modal,
  Portal,
  Text,
  Button,
  IconButton,
  Divider,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { theme } from '../../theme';
import {
  DryRunRequest,
  DryRunResult,
  ruleConfigApiClient,
} from '../../services/api/ruleConfigApiClient';

interface DryRunPreviewModalProps {
  visible: boolean;
  onDismiss: () => void;
  /** 初始规则内容 (可选，从规则编辑器传入) */
  initialRuleContent?: string;
  /** 实体类型 (可选) */
  entityType?: string;
  /** 挂载点 (可选) */
  hookPoint?: string;
  /** 规则保存成功后的回调 */
  onSaveRule?: (ruleContent: string) => void;
}

/**
 * 规则 Dry-Run 预览弹窗
 *
 * 功能:
 * - 输入 DRL 规则内容
 * - 输入测试数据 (JSON 格式)
 * - 执行沙箱测试
 * - 展示规则匹配结果、模拟变更、警告/错误
 * - 支持测试通过后保存规则
 */
export const DryRunPreviewModal: React.FC<DryRunPreviewModalProps> = ({
  visible,
  onDismiss,
  initialRuleContent = '',
  entityType: initialEntityType = '',
  hookPoint: initialHookPoint = '',
  onSaveRule,
}) => {
  // 输入状态
  const [ruleContent, setRuleContent] = useState(initialRuleContent);
  const [testDataJson, setTestDataJson] = useState('{\n  "sampleField": "sampleValue"\n}');
  const [entityType, setEntityType] = useState(initialEntityType);
  const [hookPoint, setHookPoint] = useState(initialHookPoint);

  // 执行状态
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // 重置状态
  React.useEffect(() => {
    if (visible) {
      // 打开时使用传入的初始值
      setRuleContent(initialRuleContent);
      setEntityType(initialEntityType);
      setHookPoint(initialHookPoint);
      setResult(null);
      setParseError(null);
    }
  }, [visible, initialRuleContent, initialEntityType, initialHookPoint]);

  // 解析测试数据 JSON
  const parseTestData = useCallback((): Record<string, unknown> | null => {
    try {
      const data = JSON.parse(testDataJson.trim() || '{}');
      setParseError(null);
      return data;
    } catch (err) {
      setParseError('测试数据 JSON 格式错误: ' + (err instanceof Error ? err.message : String(err)));
      return null;
    }
  }, [testDataJson]);

  // 执行 Dry-Run
  const handleExecute = async () => {
    const testData = parseTestData();
    if (!testData) return;

    if (!ruleContent.trim()) {
      setResult({
        success: false,
        rulesMatched: [],
        result: 'ERROR',
        firedCount: 0,
        simulatedChanges: {},
        validationErrors: ['规则内容不能为空'],
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const request: DryRunRequest = {
        ruleContent: ruleContent.trim(),
        entityType: entityType || undefined,
        hookPoint: hookPoint || undefined,
        testData,
      };

      const dryRunResult = await ruleConfigApiClient.dryRun(request);
      setResult(dryRunResult);
    } catch (err) {
      console.error('Dry-run 执行失败:', err);
      setResult({
        success: false,
        rulesMatched: [],
        result: 'ERROR',
        firedCount: 0,
        simulatedChanges: {},
        validationErrors: [err instanceof Error ? err.message : '执行失败'],
      });
    } finally {
      setLoading(false);
    }
  };

  // 保存规则
  const handleSaveRule = () => {
    if (result?.success && onSaveRule) {
      onSaveRule(ruleContent.trim());
      onDismiss();
    }
  };

  // 渲染结果状态
  const renderResultStatus = () => {
    if (!result) return null;

    const statusConfig = result.success
      ? { bg: '#F6FFED', border: '#B7EB8F', text: '#52C41A', label: '测试通过' }
      : { bg: '#FFF1F0', border: '#FFA39E', text: '#FF4D4F', label: '测试失败' };

    return (
      <View style={[styles.statusCard, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
        <Text style={[styles.statusLabel, { color: statusConfig.text }]}>
          {statusConfig.label}
        </Text>
        {result.executionTimeMs !== undefined && (
          <Text style={styles.executionTime}>
            执行耗时: {result.executionTimeMs}ms
          </Text>
        )}
      </View>
    );
  };

  // 渲染规则匹配结果
  const renderRulesMatched = () => {
    if (!result || result.rulesMatched.length === 0) return null;

    return (
      <View style={styles.resultSection}>
        <Text style={styles.resultSectionTitle}>
          命中规则 ({result.rulesMatched.length})
        </Text>
        <View style={styles.chipContainer}>
          {result.rulesMatched.map((rule, index) => (
            <Chip key={index} style={styles.ruleChip} textStyle={styles.ruleChipText}>
              {rule}
            </Chip>
          ))}
        </View>
        {result.firedCount > 0 && (
          <Text style={styles.firedCountText}>
            触发次数: {result.firedCount}
          </Text>
        )}
      </View>
    );
  };

  // 渲染模拟变更
  const renderSimulatedChanges = () => {
    if (!result || !result.simulatedChanges || Object.keys(result.simulatedChanges).length === 0) {
      return null;
    }

    return (
      <View style={styles.resultSection}>
        <Text style={styles.resultSectionTitle}>模拟变更</Text>
        <View style={styles.changesContainer}>
          {Object.entries(result.simulatedChanges).map(([key, value], index) => (
            <View key={index} style={styles.changeItem}>
              <Text style={styles.changeKey}>{key}:</Text>
              <Text style={styles.changeValue}>
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // 渲染验证错误
  const renderValidationErrors = () => {
    if (!result?.validationErrors || result.validationErrors.length === 0) return null;

    return (
      <View style={styles.resultSection}>
        <Text style={[styles.resultSectionTitle, { color: '#FF4D4F' }]}>
          验证错误 ({result.validationErrors.length})
        </Text>
        {result.validationErrors.map((error, index) => (
          <View key={index} style={styles.errorItem}>
            <IconButton icon="alert-circle" size={16} iconColor="#FF4D4F" style={styles.errorIcon} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ))}
      </View>
    );
  };

  // 渲染警告
  const renderWarnings = () => {
    if (!result?.warnings || result.warnings.length === 0) return null;

    return (
      <View style={styles.resultSection}>
        <Text style={[styles.resultSectionTitle, { color: '#FA8C16' }]}>
          警告 ({result.warnings.length})
        </Text>
        {result.warnings.map((warning, index) => (
          <View key={index} style={styles.warningItem}>
            <IconButton icon="alert" size={16} iconColor="#FA8C16" style={styles.errorIcon} />
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>规则 Dry-Run 测试</Text>
          <IconButton
            icon="close"
            size={24}
            onPress={onDismiss}
            style={styles.closeButton}
          />
        </View>

        <Divider />

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* 规则内容输入 */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>DRL 规则内容 *</Text>
            <TextInput
              style={styles.ruleInput}
              value={ruleContent}
              onChangeText={setRuleContent}
              placeholder={`rule "示例规则"\nwhen\n  $fact: SomeFact(...)\nthen\n  // 规则动作\nend`}
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* 可选参数 */}
          <View style={styles.optionalParams}>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>实体类型:</Text>
              <TextInput
                style={styles.paramInput}
                value={entityType}
                onChangeText={setEntityType}
                placeholder="如: PRODUCTION_BATCH"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>挂载点:</Text>
              <TextInput
                style={styles.paramInput}
                value={hookPoint}
                onChangeText={setHookPoint}
                placeholder="如: PRE_SUBMIT"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* 测试数据输入 */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>测试数据 (JSON 格式)</Text>
            <TextInput
              style={styles.testDataInput}
              value={testDataJson}
              onChangeText={setTestDataJson}
              placeholder='{ "field": "value" }'
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {parseError && (
              <Text style={styles.parseErrorText}>{parseError}</Text>
            )}
          </View>

          {/* 执行按钮 */}
          <Button
            mode="contained"
            onPress={handleExecute}
            loading={loading}
            disabled={loading || !ruleContent.trim()}
            style={styles.executeButton}
            icon="play"
          >
            执行 Dry-Run 测试
          </Button>

          <Divider style={styles.resultDivider} />

          {/* 结果展示 */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>正在沙箱环境中执行规则...</Text>
            </View>
          ) : result ? (
            <View style={styles.resultContainer}>
              {renderResultStatus()}
              {renderValidationErrors()}
              {renderWarnings()}
              {renderRulesMatched()}
              {renderSimulatedChanges()}

              {/* 结果原始输出 */}
              {result.result && result.result !== 'ERROR' && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>执行结果</Text>
                  <Text style={styles.resultOutput}>{result.result}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyResultContainer}>
              <Text style={styles.emptyResultText}>
                点击上方按钮执行 Dry-Run 测试
              </Text>
              <Text style={styles.emptyResultHint}>
                测试将在沙箱环境中运行，不会影响生产数据
              </Text>
            </View>
          )}
        </ScrollView>

        <Divider />

        {/* Footer Actions */}
        <View style={styles.footer}>
          <Button mode="outlined" onPress={onDismiss} style={styles.footerButton}>
            关闭
          </Button>
          {result?.success && onSaveRule && (
            <Button
              mode="contained"
              onPress={handleSaveRule}
              style={styles.footerButton}
              icon="content-save"
            >
              保存规则
            </Button>
          )}
        </View>
      </Modal>
    </Portal>
  );
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    borderRadius: theme.custom.borderRadius.l,
    maxHeight: SCREEN_HEIGHT * 0.9,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    margin: 0,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.65,
  },
  scrollContent: {
    padding: 16,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  ruleInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.custom.borderRadius.s,
    padding: 12,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 160,
    backgroundColor: '#1E1E1E',
    color: '#D4D4D4',
  },
  optionalParams: {
    marginBottom: 16,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paramLabel: {
    width: 80,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  paramInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.custom.borderRadius.s,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: theme.colors.surfaceVariant,
  },
  testDataInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.custom.borderRadius.s,
    padding: 12,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 100,
    backgroundColor: theme.colors.surfaceVariant,
  },
  parseErrorText: {
    color: '#FF4D4F',
    fontSize: 12,
    marginTop: 4,
  },
  executeButton: {
    marginVertical: 16,
  },
  resultDivider: {
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  resultContainer: {
    marginBottom: 16,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: theme.custom.borderRadius.s,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  executionTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  resultSection: {
    marginBottom: 16,
  },
  resultSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleChip: {
    backgroundColor: '#E6F7FF',
  },
  ruleChipText: {
    color: '#1890FF',
    fontSize: 12,
  },
  firedCountText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  changesContainer: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.custom.borderRadius.s,
    padding: 12,
  },
  changeItem: {
    marginBottom: 8,
  },
  changeKey: {
    fontSize: 13,
    fontWeight: '600',
    color: '#52C41A',
  },
  changeValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: theme.colors.text,
    marginTop: 2,
  },
  errorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF1F0',
    borderRadius: theme.custom.borderRadius.s,
    padding: 8,
    marginBottom: 4,
  },
  errorIcon: {
    margin: 0,
    marginRight: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#FF4D4F',
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF7E6',
    borderRadius: theme.custom.borderRadius.s,
    padding: 8,
    marginBottom: 4,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#FA8C16',
  },
  resultOutput: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceVariant,
    padding: 12,
    borderRadius: theme.custom.borderRadius.s,
  },
  emptyResultContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyResultText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  emptyResultHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
  },
  footerButton: {
    minWidth: 100,
  },
});

export default DryRunPreviewModal;
