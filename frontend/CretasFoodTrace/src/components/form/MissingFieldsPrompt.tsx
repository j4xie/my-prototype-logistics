/**
 * 缺失字段追问组件
 *
 * 当AI解析成功但检测到缺失必填字段时，显示此弹窗
 * 引导用户补充缺失的信息，支持文本和语音输入
 *
 * @example
 * ```tsx
 * <MissingFieldsPrompt
 *   visible={showPrompt}
 *   onDismiss={() => setShowPrompt(false)}
 *   missingFields={['quantity', 'temperature']}
 *   suggestedQuestions={['请问数量是多少？', '温度是多少度？']}
 *   followUpQuestion="还需要补充数量和温度信息"
 *   onSubmit={(answers) => {
 *     // 将答案合并到表单
 *     form.setValues({ ...form.values, ...answers });
 *   }}
 *   onCancel={() => setShowPrompt(false)}
 * />
 * ```
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
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
  Surface,
  useTheme,
  Chip,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { speechRecognitionService } from '../../services/voice/SpeechRecognitionService';

// ========== 类型定义 ==========

export interface MissingFieldsPromptProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onDismiss: () => void;
  /** 缺失的字段名列表 */
  missingFields: string[];
  /** AI生成的追问列表（与 missingFields 一一对应） */
  suggestedQuestions: string[];
  /** 主要追问问题（用于弹窗标题） */
  followUpQuestion?: string;
  /** 提交回调（用户回答 -> 字段值映射） */
  onSubmit: (answers: Record<string, string>) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否正在处理 */
  isLoading?: boolean;
}

// ========== 组件实现 ==========

export function MissingFieldsPrompt({
  visible,
  onDismiss,
  missingFields,
  suggestedQuestions,
  followUpQuestion,
  onSubmit,
  onCancel,
  isLoading = false,
}: MissingFieldsPromptProps): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation('common');

  // 状态：每个缺失字段的答案
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // 语音输入状态
  const [recordingFieldIndex, setRecordingFieldIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // 重置状态
  useEffect(() => {
    if (visible) {
      // 初始化空答案
      const initialAnswers: Record<string, string> = {};
      missingFields.forEach((field) => {
        initialAnswers[field] = '';
      });
      setAnswers(initialAnswers);
      setRecordingFieldIndex(null);
      setIsRecording(false);
    }
  }, [visible, missingFields]);

  /**
   * 更新答案
   */
  const updateAnswer = useCallback((fieldName: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  /**
   * 开始语音输入
   */
  const startVoiceInput = useCallback(async (fieldIndex: number) => {
    // 检查权限
    const hasPermission = await speechRecognitionService.requestPermissions();
    if (!hasPermission) {
      console.warn('[MissingFieldsPrompt] 未获得录音权限');
      return;
    }

    try {
      setRecordingFieldIndex(fieldIndex);
      setIsRecording(true);
      await speechRecognitionService.startListening();
    } catch (err) {
      console.error('[MissingFieldsPrompt] 录音启动失败:', err);
      setIsRecording(false);
      setRecordingFieldIndex(null);
    }
  }, []);

  /**
   * 停止语音输入
   */
  const stopVoiceInput = useCallback(async () => {
    if (recordingFieldIndex === null) return;

    try {
      const result = await speechRecognitionService.stopListening();
      setIsRecording(false);

      if (result.text && result.text !== '[语音识别需要配置讯飞密钥]') {
        const fieldName = missingFields[recordingFieldIndex];
        if (fieldName) {
          updateAnswer(fieldName, result.text);
        }
      }

      setRecordingFieldIndex(null);
    } catch (err) {
      console.error('[MissingFieldsPrompt] 语音识别失败:', err);
      setIsRecording(false);
      setRecordingFieldIndex(null);
    }
  }, [recordingFieldIndex, missingFields, updateAnswer]);

  /**
   * 提交答案
   */
  const handleSubmit = useCallback(() => {
    // 过滤掉空答案
    const validAnswers: Record<string, string> = {};
    Object.entries(answers).forEach(([key, value]) => {
      if (value.trim()) {
        validAnswers[key] = value.trim();
      }
    });

    if (Object.keys(validAnswers).length === 0) {
      console.warn('[MissingFieldsPrompt] 没有有效答案');
      return;
    }

    onSubmit(validAnswers);
  }, [answers, onSubmit]);

  /**
   * 取消
   */
  const handleCancel = useCallback(() => {
    if (isRecording) {
      speechRecognitionService.cancel();
      setIsRecording(false);
      setRecordingFieldIndex(null);
    }
    onCancel();
  }, [isRecording, onCancel]);

  /**
   * 渲染单个缺失字段的输入项
   */
  const renderFieldInput = (fieldName: string, question: string, index: number) => {
    const isCurrentRecording = recordingFieldIndex === index;

    return (
      <Card key={`${fieldName}-${index}`} style={styles.fieldCard} mode="outlined">
        <Card.Content>
          <View style={styles.fieldHeader}>
            <Text variant="titleSmall" style={styles.fieldName}>
              {fieldName}
            </Text>
            <Chip
              compact
              mode="outlined"
              textStyle={styles.chipText}
              style={styles.chip}
            >
              {t('form.missingFields.required')}
            </Chip>
          </View>

          <Text style={styles.question}>{question}</Text>

          <View style={styles.inputRow}>
            <TextInput
              mode="outlined"
              placeholder={t('form.missingFields.placeholder')}
              value={answers[fieldName] || ''}
              onChangeText={(text) => updateAnswer(fieldName, text)}
              style={styles.textInput}
              disabled={isLoading || isRecording}
            />

            <IconButton
              icon={isCurrentRecording ? 'stop' : 'microphone'}
              iconColor={isCurrentRecording ? '#FF5722' : '#2196F3'}
              size={24}
              mode="contained-tonal"
              onPress={
                isCurrentRecording
                  ? stopVoiceInput
                  : () => startVoiceInput(index)
              }
              disabled={isLoading || (isRecording && !isCurrentRecording)}
              style={styles.voiceButton}
            />
          </View>

          {isCurrentRecording && (
            <View style={styles.recordingIndicator}>
              <ActivityIndicator size="small" color="#FF5722" />
              <Text style={styles.recordingText}>{t('form.missingFields.recording')}</Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  /**
   * 检查是否至少有一个答案
   */
  const hasAnyAnswer = Object.values(answers).some((value) => value.trim());

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleCancel}
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
            <View style={styles.titleContainer}>
              <IconButton icon="robot" size={24} iconColor={theme.colors.primary} />
              <Text variant="titleLarge" style={styles.title}>
                {followUpQuestion || t('form.missingFields.title')}
              </Text>
            </View>
            <IconButton icon="close" size={24} onPress={handleCancel} />
          </View>

          <Divider />

          {/* 字段输入列表 */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <Text variant="bodyMedium" style={styles.sectionTitle}>
              {t('form.missingFields.pleaseComplete', { count: missingFields.length })}
            </Text>

            {missingFields.map((field, index) => {
              const question = suggestedQuestions[index] || `请输入 ${field}`;
              return renderFieldInput(field, question, index);
            })}

            <Surface style={styles.tipBox} elevation={1}>
              <IconButton icon="information" size={20} iconColor="#2196F3" />
              <Text style={styles.tipText}>
                {t('form.missingFields.tip')}
              </Text>
            </Surface>
          </ScrollView>

          <Divider />

          {/* 操作按钮 */}
          <View style={styles.buttonContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
                <Text style={styles.loadingText}>{t('form.missingFields.aiProcessing')}</Text>
              </View>
            ) : (
              <>
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  style={styles.button}
                  disabled={isLoading}
                >
                  {t('form.missingFields.skip')}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  style={styles.button}
                  disabled={isLoading || !hasAnyAnswer}
                >
                  {t('form.missingFields.continue')}
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
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontWeight: '600',
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    marginVertical: 12,
    color: '#666',
  },
  fieldCard: {
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldName: {
    fontWeight: '600',
    color: '#333',
  },
  chip: {
    height: 24,
  },
  chipText: {
    fontSize: 10,
  },
  question: {
    fontSize: 14,
    color: '#2196F3',
    marginBottom: 12,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
  },
  voiceButton: {
    margin: 0,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
  },
  recordingText: {
    marginLeft: 8,
    color: '#FF5722',
    fontSize: 12,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
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

export default MissingFieldsPrompt;
