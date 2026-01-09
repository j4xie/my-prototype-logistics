/**
 * AI 对话屏幕
 *
 * 独立的AI聊天界面，不依赖预先的sessionId
 * - 显示欢迎消息和快捷问题
 * - 用户可直接输入问题
 * - 第一条消息时创建新会话
 * - 后续消息复用同一会话
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { aiService, detectAnalysisMode } from '../../../services/ai';
import type { AnalysisMode } from '../../../services/ai/types';
import { AIModeIndicator } from '../../../components/ai/AIModeIndicator';
import { useAuthStore } from '../../../store/authStore';

// 消息类型
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  /** AI 分析模式 (仅 assistant 消息) */
  mode?: AnalysisMode;
  /** 响应时间 (仅 assistant 消息) */
  responseTimeMs?: number;
}

export default function AIChatScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t, i18n } = useTranslation('home');
  const scrollViewRef = useRef<ScrollView>(null);

  // 快捷问题列表
  const QUICK_QUESTIONS = [
    t('aiChat.question1'),
    t('aiChat.question2'),
    t('aiChat.question3'),
    t('aiChat.question4'),
  ];

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);

  // 实时检测当前输入的分析模式
  const detectedMode = useMemo(() => {
    if (!inputText.trim()) return null;
    return detectAnalysisMode(inputText);
  }, [inputText]);

  // 生成唯一消息ID
  const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // 用于取消流式请求的 AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // 清理函数
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // 模拟流式显示效果（快速获取响应后逐字显示）
  const simulateStreaming = useCallback(
    (fullText: string, messageId: string, onComplete: () => void) => {
      let currentIndex = 0;
      const charsPerTick = 3; // 每次显示3个字符，速度更快
      const tickInterval = 20; // 20ms 间隔

      const tick = () => {
        if (currentIndex < fullText.length) {
          currentIndex = Math.min(currentIndex + charsPerTick, fullText.length);
          const displayText = fullText.substring(0, currentIndex);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, content: displayText, isLoading: currentIndex < fullText.length }
                : msg
            )
          );
          scrollToBottom();

          setTimeout(tick, tickInterval);
        } else {
          // 完成显示
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, isLoading: false } : msg
            )
          );
          onComplete();
        }
      };

      tick();
    },
    [scrollToBottom]
  );

  // 发送消息 - 快速API + 模拟流式显示
  const handleSend = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading) return;

    setInputText('');
    setIsLoading(true);

    // 添加用户消息
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    scrollToBottom();

    // 添加 AI 回复消息（初始为空，逐步填充）
    const assistantMessageId = generateMessageId();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      },
    ]);
    scrollToBottom();

    try {
      // 使用集中式 AI 服务执行意图
      // aiService 自动处理：
      // - 分析模式检测 (enableThinking/thinkingBudget)
      // - 响应时间追踪
      // - 错误处理
      const result = await aiService.executeIntent(messageText, {
        sessionId: sessionId ?? undefined,
        forceExecute: true,
      });

      console.log('[AI Chat] aiService 响应:', result);
      console.log('[AI Chat] 分析模式:', result.mode, result.modeReason);

      // 提取回复消息
      let replyMessage = '';

      if (result.success && result.data) {
        // result.data 是 IntentExecuteResponse 类型
        // 使用 unknown 作为中间类型避免类型断言错误
        const responseData = result.data as unknown as Record<string, unknown>;

        // 优先使用 metadata.conversationMessage
        const metadata = responseData.metadata as { conversationMessage?: string; sessionId?: string } | undefined;
        if (metadata?.conversationMessage) {
          replyMessage = metadata.conversationMessage;
        } else if (typeof responseData.message === 'string') {
          replyMessage = responseData.message;
        } else {
          replyMessage = t('aiChat.defaultReply');
        }

        // 更新 sessionId (可能在 metadata 或 responseData 中)
        const newSessionId = (metadata?.sessionId || responseData.sessionId) as string | undefined;
        if (newSessionId) {
          setSessionId(newSessionId);
        }
      } else {
        // 失败情况
        replyMessage = result.errorMessage || result.data?.message || t('aiChat.networkError');
      }

      // 更新消息，添加模式和响应时间信息
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                mode: result.mode,
                responseTimeMs: result.responseTimeMs,
              }
            : msg
        )
      );

      // 使用模拟流式效果显示回复
      simulateStreaming(replyMessage, assistantMessageId, () => {
        setIsLoading(false);
      });

    } catch (error) {
      console.error('AI 对话失败:', error);

      // 移除空消息
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));

      const errorMessage = error instanceof Error ? error.message : t('aiChat.networkError');
      Alert.alert(t('aiChat.sendFailed'), errorMessage, [{ text: i18next.t('common:confirm') }]);
      setIsLoading(false);
    }
  };

  // 渲染消息
  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';

    // 流式加载状态：无内容时显示思考动画，有内容时显示内容+光标
    if (message.isLoading && !message.content) {
      return (
        <View key={message.id} style={styles.messageRow}>
          <View style={styles.aiAvatar}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.avatarGradient}
            >
              <IconButton icon="robot" size={18} iconColor="#fff" />
            </LinearGradient>
          </View>
          <View style={styles.aiMessageBubble}>
            <ActivityIndicator size="small" color="#667eea" />
            <Text style={styles.loadingText}>{t('aiChat.thinking')}</Text>
          </View>
        </View>
      );
    }

    if (isUser) {
      return (
        <View key={message.id} style={styles.userMessageRow}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.userMessageBubble}
          >
            <Text style={styles.userMessageText}>{message.content}</Text>
          </LinearGradient>
          <Text style={styles.timestamp}>
            {message.timestamp.toLocaleTimeString(i18n.language, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      );
    }

    return (
      <View key={message.id} style={styles.messageRow}>
        <View style={styles.aiAvatar}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.avatarGradient}
          >
            <IconButton icon="robot" size={18} iconColor="#fff" />
          </LinearGradient>
        </View>
        <View style={styles.aiMessageContainer}>
          {/* 显示分析模式指示器 (在消息气泡上方) */}
          {message.mode && !message.isLoading && (
            <View style={styles.modeIndicatorRow}>
              <AIModeIndicator mode={message.mode} size="small" />
              {message.responseTimeMs && (
                <Text style={styles.responseTime}>
                  {(message.responseTimeMs / 1000).toFixed(1)}s
                </Text>
              )}
            </View>
          )}
          <View style={styles.aiMessageBubble}>
            <Text style={styles.aiMessageText}>
              {message.content}
              {/* 流式输出时显示闪烁光标 */}
              {message.isLoading && message.content && (
                <Text style={styles.streamingCursor}>|</Text>
              )}
            </Text>
          </View>
          {!message.isLoading && (
            <Text style={styles.timestamp}>
              {message.timestamp.toLocaleTimeString(i18n.language, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // 渲染欢迎消息
  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      {/* AI 欢迎消息 */}
      <View style={styles.messageRow}>
        <View style={styles.aiAvatar}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.avatarGradient}
          >
            <IconButton icon="robot" size={18} iconColor="#fff" />
          </LinearGradient>
        </View>
        <View style={styles.aiMessageBubble}>
          <Text style={styles.aiMessageText}>
            {t('aiChat.welcome')}
          </Text>
          <Text style={[styles.aiMessageText, { marginTop: 8 }]}>
            {t('aiChat.canHelp')}
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• {t('aiChat.help1')}</Text>
            <Text style={styles.bulletItem}>• {t('aiChat.help2')}</Text>
            <Text style={styles.bulletItem}>• {t('aiChat.help3')}</Text>
            <Text style={styles.bulletItem}>• {t('aiChat.help4')}</Text>
          </View>
        </View>
      </View>

      {/* 快捷问题 */}
      <View style={styles.quickQuestionsContainer}>
        <Text style={styles.quickQuestionsTitle}>{t('aiChat.quickQuestions')}</Text>
        <View style={styles.quickQuestionsGrid}>
          {QUICK_QUESTIONS.map((question, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickQuestionButton}
              onPress={() => handleSend(question)}
              disabled={isLoading}
            >
              <Text style={styles.quickQuestionText}>{question}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 配额提示 */}
      {quotaRemaining !== null && (
        <View style={styles.quotaBanner}>
          <IconButton icon="information" size={16} iconColor="#faad14" />
          <Text style={styles.quotaText}>
            {t('aiChat.remainingQuota')}：<Text style={styles.quotaNumber}>{quotaRemaining}</Text> {t('aiChat.times')}
          </Text>
        </View>
      )}

      {/* 消息区域 */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={scrollToBottom}
        >
          {messages.length === 0 ? renderWelcome() : messages.map(renderMessage)}
        </ScrollView>

        {/* 输入区域 */}
        <View style={styles.inputAreaContainer}>
          {/* 实时模式检测指示器 - 仅在有输入时显示 */}
          {detectedMode && (
            <View style={styles.inputModeIndicator}>
              <AIModeIndicator mode={detectedMode.mode} size="small" />
              <Text style={styles.inputModeHint}>
                {detectedMode.mode === 'deep' ? t('aiChat.deepModeHint') : t('aiChat.quickModeHint')}
              </Text>
            </View>
          )}
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.addButton}>
              <IconButton icon="plus" size={20} iconColor="#666" />
            </TouchableOpacity>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={t('aiChat.inputPlaceholder')}
                placeholderTextColor="#999"
                multiline
                maxLength={500}
                editable={!isLoading}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
              onPress={() => handleSend()}
              disabled={isLoading || !inputText.trim()}
            >
              <LinearGradient
                colors={isLoading || !inputText.trim() ? ['#ccc', '#ccc'] : ['#667eea', '#764ba2']}
                style={styles.sendButtonGradient}
              >
                <IconButton
                  icon="send"
                  size={18}
                  iconColor="#fff"
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbe6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ffe58f',
  },
  quotaText: {
    fontSize: 13,
    color: '#ad6800',
  },
  quotaNumber: {
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 100,
  },
  welcomeContainer: {
    flex: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userMessageRow: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  aiAvatar: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  avatarGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiMessageContainer: {
    flex: 1,
  },
  aiMessageBubble: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderTopLeftRadius: 0,
    padding: 12,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  aiMessageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  userMessageBubble: {
    borderRadius: 12,
    borderTopRightRadius: 0,
    padding: 12,
    maxWidth: '75%',
  },
  userMessageText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  bulletList: {
    marginTop: 8,
  },
  bulletItem: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 13,
    color: '#667eea',
    marginLeft: 8,
  },
  streamingCursor: {
    color: '#667eea',
    fontWeight: '300',
  },
  quickQuestionsContainer: {
    marginTop: 20,
    marginLeft: 46,
  },
  quickQuestionsTitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
  },
  quickQuestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickQuestionButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickQuestionText: {
    fontSize: 13,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginHorizontal: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    maxHeight: 100,
  },
  input: {
    fontSize: 14,
    color: '#333',
    maxHeight: 80,
  },
  sendButton: {
    width: 36,
    height: 36,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 模式指示器相关样式
  modeIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  responseTime: {
    fontSize: 11,
    color: '#999',
  },
  inputAreaContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  inputModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  inputModeHint: {
    fontSize: 11,
    color: '#999',
    flex: 1,
  },
});
