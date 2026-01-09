/**
 * SKU 语音配置对话框
 *
 * 全屏对话框，用于语音录入 SKU 配置
 * 包含录音、AI 响应显示、配置确认等功能
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Portal,
  Modal,
  Text,
  Button,
  IconButton,
  TextInput,
  Divider,
  Surface,
  ActivityIndicator,
} from 'react-native-paper';
import { useSkuConfigVoiceStore, useMessages, useAccumulatedConfig } from '../../store/skuConfigVoiceStore';
import { skuConfigVoiceService } from '../../services/voice/SkuConfigVoiceService';
import { SkuConfirmCard } from './SkuConfirmCard';
import type { ExtractedSkuConfig } from '../../services/ai/SkuConfigAIPrompt';

// ==================== 类型定义 ====================

interface SkuVoiceDialogProps {
  /** 确认配置回调 */
  onConfirm: (config: ExtractedSkuConfig) => void;
  /** 取消回调 */
  onCancel?: () => void;
}

// ==================== 子组件 ====================

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
      <Text style={[styles.messageText, isUser && styles.userMessageText]}>
        {content}
      </Text>
      {timestamp && (
        <Text style={styles.messageTime}>
          {new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
    </View>
  );
}

// ==================== 录音指示器 ====================

function RecordingIndicator({ duration }: { duration: number }) {
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.recordingIndicator}>
      <Animated.View
        style={[
          styles.recordingDot,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
      <Text style={styles.recordingText}>
        正在录音 {duration.toFixed(0)}秒
      </Text>
    </View>
  );
}

// ==================== 主组件 ====================

export function SkuVoiceDialog({ onConfirm, onCancel }: SkuVoiceDialogProps) {
  const {
    dialogVisible,
    status,
    isEditMode,
    recordingDuration,
    latestResponse,
    closeDialog,
    startListening,
    stopListening,
    updateRecordingDuration,
    setTranscribedText,
    setAIResponse,
    confirmConfig,
    resetSession,
    setError,
  } = useSkuConfigVoiceStore();

  const messages = useMessages();
  const accumulatedConfig = useAccumulatedConfig();

  const [textInput, setTextInput] = useState('');
  const [isTextMode, setIsTextMode] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化会话
  useEffect(() => {
    if (dialogVisible) {
      skuConfigVoiceService.startSession({ isEditMode });
    }
  }, [dialogVisible, isEditMode]);

  // 自动滚动到底部
  useEffect(() => {
    if (messages.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // 录音计时器
  useEffect(() => {
    if (status === 'listening') {
      recordingTimerRef.current = setInterval(() => {
        updateRecordingDuration(recordingDuration + 0.5);
      }, 500);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [status, recordingDuration, updateRecordingDuration]);

  // 开始录音
  const handleStartRecording = useCallback(async () => {
    try {
      startListening();
      await skuConfigVoiceService.startListening();
    } catch (error) {
      setError(error instanceof Error ? error.message : '启动录音失败');
    }
  }, [startListening, setError]);

  // 停止录音
  const handleStopRecording = useCallback(async () => {
    try {
      stopListening();
      const response = await skuConfigVoiceService.stopListening();
      if (response) {
        setAIResponse(response);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '处理录音失败');
    }
  }, [stopListening, setAIResponse, setError]);

  // 发送文本
  const handleSendText = useCallback(async () => {
    if (!textInput.trim()) return;

    const text = textInput.trim();
    setTextInput('');
    setTranscribedText(text);

    try {
      const response = await skuConfigVoiceService.processTextInput(text);
      if (response) {
        setAIResponse(response);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '处理失败');
    }
  }, [textInput, setTranscribedText, setAIResponse, setError]);

  // 确认配置
  const handleConfirm = useCallback(() => {
    const config = confirmConfig();
    if (config) {
      onConfirm(config);
    }
  }, [confirmConfig, onConfirm]);

  // 取消
  const handleCancel = useCallback(async () => {
    await skuConfigVoiceService.cancel();
    closeDialog();
    onCancel?.();
  }, [closeDialog, onCancel]);

  // 重试
  const handleRetry = useCallback(async () => {
    await skuConfigVoiceService.retry();
    resetSession();
  }, [resetSession]);

  // 渲染内容
  const renderContent = () => {
    // 确认状态显示确认卡片
    if (status === 'confirming' && accumulatedConfig) {
      return (
        <SkuConfirmCard
          config={accumulatedConfig}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onRetry={handleRetry}
          confidence={latestResponse?.confidence}
          loading={false}
        />
      );
    }

    // 默认显示对话界面
    return (
      <>
        {/* 消息列表 */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 欢迎消息 */}
          {messages.length === 0 && (
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>
                {isEditMode ? '语音修改配置' : '语音配置 SKU'}
              </Text>
              <Text style={styles.welcomeText}>
                {isEditMode
                  ? '请说出您想修改的配置，如："把工时改成5小时"'
                  : '请描述您的产品加工配置，如："这是海鲜预制菜，工时4小时，包含解冻、清洗、烹饪、包装"'}
              </Text>
            </View>
          )}

          {/* 对话消息 */}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          ))}

          {/* 处理中指示器 */}
          {status === 'processing' && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color="#1890ff" />
              <Text style={styles.processingText}>AI 正在分析...</Text>
            </View>
          )}
        </ScrollView>

        <Divider />

        {/* 底部输入区 */}
        <View style={styles.inputArea}>
          {/* 录音状态指示 */}
          {status === 'listening' && (
            <RecordingIndicator duration={recordingDuration} />
          )}

          {/* 文本输入模式 */}
          {isTextMode ? (
            <View style={styles.textInputRow}>
              <TextInput
                mode="outlined"
                placeholder="输入配置描述..."
                value={textInput}
                onChangeText={setTextInput}
                style={styles.textInput}
                dense
                right={
                  <TextInput.Icon
                    icon="send"
                    onPress={handleSendText}
                    disabled={!textInput.trim() || status === 'processing'}
                  />
                }
                onSubmitEditing={handleSendText}
              />
              <IconButton
                icon="microphone"
                size={24}
                onPress={() => setIsTextMode(false)}
                style={styles.switchButton}
              />
            </View>
          ) : (
            <View style={styles.voiceInputRow}>
              {/* 录音按钮 */}
              <Button
                mode={status === 'listening' ? 'contained' : 'outlined'}
                onPress={status === 'listening' ? handleStopRecording : handleStartRecording}
                icon={status === 'listening' ? 'stop' : 'microphone'}
                style={[
                  styles.recordButton,
                  status === 'listening' && styles.recordingButton,
                ]}
                disabled={status === 'processing' || status === 'speaking'}
              >
                {status === 'listening' ? '停止录音' : '按住说话'}
              </Button>

              {/* 切换到文本模式 */}
              <IconButton
                icon="keyboard"
                size={24}
                onPress={() => setIsTextMode(true)}
                style={styles.switchButton}
              />
            </View>
          )}
        </View>
      </>
    );
  };

  return (
    <Portal>
      <Modal
        visible={dialogVisible}
        onDismiss={handleCancel}
        contentContainerStyle={styles.modal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          {/* 顶部标题栏 */}
          <View style={styles.header}>
            <IconButton
              icon="close"
              size={24}
              onPress={handleCancel}
            />
            <Text style={styles.headerTitle}>
              {isEditMode ? '语音修改配置' : '语音配置'}
            </Text>
            <IconButton
              icon="refresh"
              size={24}
              onPress={handleRetry}
              disabled={status === 'listening' || status === 'processing'}
            />
          </View>

          <Divider />

          {/* 主内容 */}
          {renderContent()}
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  modal: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    maxHeight: '90%',
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 24,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    marginVertical: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1890ff',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginVertical: 4,
  },
  processingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  inputArea: {
    padding: 12,
    backgroundColor: '#fafafa',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f5222d',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    color: '#f5222d',
    fontWeight: '500',
  },
  voiceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordButton: {
    flex: 1,
  },
  recordingButton: {
    backgroundColor: '#f5222d',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#fff',
  },
  switchButton: {
    margin: 0,
  },
});

export default SkuVoiceDialog;
