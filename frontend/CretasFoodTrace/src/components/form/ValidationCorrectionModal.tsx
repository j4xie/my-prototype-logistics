/**
 * 校验修正弹窗组件
 *
 * 当表单校验失败时，将错误信息反馈给AI
 * AI分析错误并返回修正建议，用户可选择应用建议或手动修改
 *
 * @example
 * ```tsx
 * <ValidationCorrectionModal
 *   visible={showModal}
 *   onDismiss={() => setShowModal(false)}
 *   validationErrors={errors}
 *   submittedValues={formValues}
 *   entityType={EntityType.MATERIAL_BATCH}
 *   onApplySuggestions={(correctedValues) => {
 *     form.setValues(correctedValues);
 *   }}
 *   onRetry={() => form.submit()}
 * />
 * ```
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Modal,
  Portal,
  Text,
  Button,
  Card,
  Divider,
  TextInput,
  ActivityIndicator,
  IconButton,
  Chip,
  useTheme,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  formAssistantApiClient,
  ValidationError,
  ValidationFeedbackRequest,
  ValidationFeedbackResponse,
  FormFieldDefinition,
} from '../../services/api/formAssistantApiClient';
import { EntityType } from '../../services/api/formTemplateApiClient';

// ========== 类型定义 ==========

export interface ValidationCorrectionModalProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onDismiss: () => void;
  /** 校验错误列表 */
  validationErrors: ValidationError[];
  /** 用户提交的值 */
  submittedValues: Record<string, unknown>;
  /** 实体类型 */
  entityType: EntityType;
  /** 表单字段定义 (可选，帮助AI更准确理解) */
  formFields?: FormFieldDefinition[];
  /** 应用AI建议回调 */
  onApplySuggestions: (correctedValues: Record<string, unknown>) => void;
  /** 重试提交回调 */
  onRetry: () => void;
  /** 会话ID (用于多轮对话) */
  sessionId?: string;
  /** 会话ID更新回调 */
  onSessionIdChange?: (sessionId: string) => void;
}

// ========== 组件实现 ==========

export function ValidationCorrectionModal({
  visible,
  onDismiss,
  validationErrors,
  submittedValues,
  entityType,
  formFields,
  onApplySuggestions,
  onRetry,
  sessionId,
  onSessionIdChange,
}: ValidationCorrectionModalProps): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation('common');

  // 状态
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<ValidationFeedbackResponse | null>(null);
  const [userInstruction, setUserInstruction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(sessionId);

  // 重置状态
  useEffect(() => {
    if (visible) {
      setAiResponse(null);
      setUserInstruction('');
      setError(null);
      // 自动请求AI建议
      requestAISuggestions();
    }
  }, [visible]);

  /**
   * 请求AI修正建议
   */
  const requestAISuggestions = useCallback(async (instruction?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const request: ValidationFeedbackRequest = {
        sessionId: currentSessionId,
        entityType,
        formFields,
        submittedValues,
        validationErrors,
        userInstruction: instruction || userInstruction,
      };

      console.log('[ValidationCorrectionModal] 请求AI修正建议:', {
        errorCount: validationErrors.length,
        hasSessionId: !!currentSessionId,
      });

      const response = await formAssistantApiClient.submitValidationFeedback(request);

      setAiResponse(response);

      // 更新会话ID
      if (response.sessionId) {
        setCurrentSessionId(response.sessionId);
        onSessionIdChange?.(response.sessionId);
      }

      if (!response.success) {
        setError(response.message || t('form.validation.aiFailed'));
      }
    } catch (err) {
      console.error('[ValidationCorrectionModal] AI请求失败:', err);
      setError(err instanceof Error ? err.message : t('form.validation.aiUnavailable'));
    } finally {
      setIsLoading(false);
    }
  }, [
    currentSessionId,
    entityType,
    formFields,
    submittedValues,
    validationErrors,
    userInstruction,
    onSessionIdChange,
  ]);

  /**
   * 应用AI建议
   */
  const handleApplySuggestions = useCallback(() => {
    if (aiResponse?.correctedValues) {
      onApplySuggestions(aiResponse.correctedValues);
      onDismiss();
    }
  }, [aiResponse, onApplySuggestions, onDismiss]);

  /**
   * 发送补充说明
   */
  const handleSendInstruction = useCallback(() => {
    if (userInstruction.trim()) {
      requestAISuggestions(userInstruction);
      setUserInstruction('');
    }
  }, [userInstruction, requestAISuggestions]);

  /**
   * 手动修改后重试
   */
  const handleManualRetry = useCallback(() => {
    onDismiss();
    // 延迟一点让modal关闭
    setTimeout(() => {
      onRetry();
    }, 100);
  }, [onDismiss, onRetry]);

  /**
   * 渲染错误项
   */
  const renderErrorItem = (error: ValidationError, index: number) => {
    const hint = aiResponse?.correctionHints?.[error.field];
    const correctedValue = aiResponse?.correctedValues?.[error.field];

    return (
      <Card key={`${error.field}-${index}`} style={styles.errorCard} mode="outlined">
        <Card.Content>
          <View style={styles.errorHeader}>
            <Text variant="titleSmall" style={styles.fieldName}>
              {error.field}
            </Text>
            {error.rule && (
              <Chip compact mode="outlined" textStyle={styles.ruleChipText}>
                {error.rule}
              </Chip>
            )}
          </View>

          <Text style={[styles.errorMessage, { color: theme.colors.error }]}>
            {error.message}
          </Text>

          {error.currentValue !== undefined && (
            <Text style={styles.currentValue}>
              {t('form.validation.currentValue')}: {JSON.stringify(error.currentValue)}
            </Text>
          )}

          {hint && (
            <View style={[styles.hintContainer, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text style={[styles.hintLabel, { color: theme.colors.primary }]}>
                {t('form.validation.aiSuggestion')}:
              </Text>
              <Text style={styles.hintText}>{hint}</Text>
            </View>
          )}

          {correctedValue !== undefined && (
            <View style={[styles.correctedContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
              <Text style={[styles.correctedLabel, { color: theme.colors.secondary }]}>
                {t('form.validation.correctedValue')}:
              </Text>
              <Text style={styles.correctedValue}>
                {JSON.stringify(correctedValue)}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContainer,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          {/* 标题栏 */}
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.title}>
              {t('form.validation.title')}
            </Text>
            <IconButton
              icon="close"
              size={24}
              onPress={onDismiss}
            />
          </View>

          <Divider />

          {/* 错误列表 */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <Text variant="bodyMedium" style={styles.sectionTitle}>
              {t('form.validation.foundErrors', { count: validationErrors.length })}
            </Text>

            {validationErrors.map((err, index) => renderErrorItem(err, index))}

            {/* AI 解释 */}
            {aiResponse?.explanation && (
              <Card style={styles.explanationCard} mode="elevated">
                <Card.Content>
                  <View style={styles.explanationHeader}>
                    <IconButton icon="robot" size={20} />
                    <Text variant="titleSmall">{t('form.validation.aiAnalysis')}</Text>
                    {aiResponse.confidence > 0 && (
                      <Chip compact style={styles.confidenceChip}>
                        {t('form.validation.confidence')}: {Math.round(aiResponse.confidence * 100)}%
                      </Chip>
                    )}
                  </View>
                  <Text style={styles.explanationText}>
                    {aiResponse.explanation}
                  </Text>
                </Card.Content>
              </Card>
            )}

            {/* 错误提示 */}
            {error && (
              <Card style={[styles.errorAlert, { backgroundColor: theme.colors.errorContainer }]}>
                <Card.Content>
                  <Text style={{ color: theme.colors.error }}>{error}</Text>
                </Card.Content>
              </Card>
            )}
          </ScrollView>

          {/* 补充说明输入 */}
          <View style={styles.instructionContainer}>
            <TextInput
              mode="outlined"
              placeholder={t('form.validation.additionalInstructions')}
              value={userInstruction}
              onChangeText={setUserInstruction}
              style={styles.instructionInput}
              right={
                <TextInput.Icon
                  icon="send"
                  onPress={handleSendInstruction}
                  disabled={isLoading || !userInstruction.trim()}
                />
              }
              disabled={isLoading}
            />
          </View>

          <Divider />

          {/* 操作按钮 */}
          <View style={styles.buttonContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
                <Text style={styles.loadingText}>{t('form.validation.aiAnalyzing')}</Text>
              </View>
            ) : (
              <>
                <Button
                  mode="outlined"
                  onPress={handleManualRetry}
                  style={styles.button}
                >
                  {t('form.validation.manualEdit')}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleApplySuggestions}
                  style={styles.button}
                  disabled={!aiResponse?.correctedValues || Object.keys(aiResponse.correctedValues).length === 0}
                >
                  {t('form.validation.applySuggestions')}
                </Button>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

// ========== 样式 ==========

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    borderRadius: 12,
    maxHeight: '85%',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    marginVertical: 12,
    color: '#666',
  },
  errorCard: {
    marginBottom: 12,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldName: {
    fontWeight: '600',
  },
  ruleChipText: {
    fontSize: 10,
  },
  errorMessage: {
    marginBottom: 8,
  },
  currentValue: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  hintContainer: {
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  hintLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  hintText: {
    fontSize: 14,
  },
  correctedContainer: {
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  correctedLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  correctedValue: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  explanationCard: {
    marginTop: 16,
    marginBottom: 16,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  confidenceChip: {
    marginLeft: 'auto',
  },
  explanationText: {
    lineHeight: 22,
  },
  errorAlert: {
    marginVertical: 12,
  },
  instructionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  instructionInput: {
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  button: {
    minWidth: 100,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
  },
});

export default ValidationCorrectionModal;
