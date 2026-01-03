/**
 * AI 对话屏幕
 *
 * 独立的AI聊天界面，不依赖预先的sessionId
 * - 显示欢迎消息和快捷问题
 * - 用户可直接输入问题
 * - 第一条消息时创建新会话
 * - 后续消息复用同一会话
 */

import React, { useState, useRef, useCallback } from 'react';
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
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { aiApiClient, AICostAnalysisResponse } from '../../../services/api/aiApiClient';
import { useAuthStore } from '../../../store/authStore';

// 消息类型
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

export default function AIChatScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t } = useTranslation('home');
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

  // 生成唯一消息ID
  const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // 发送消息
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

    // 添加加载占位消息
    const loadingMessageId = generateMessageId();
    setMessages((prev) => [
      ...prev,
      {
        id: loadingMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      },
    ]);
    scrollToBottom();

    try {
      let response: AICostAnalysisResponse;

      if (!sessionId) {
        // 第一条消息：使用时间范围分析创建新会话
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        // 格式化日期为 YYYY-MM-DD
        const formatDate = (date: Date): string => {
          return date.toISOString().slice(0, 10);
        };

        response = await aiApiClient.analyzeTimeRangeCost({
          startDate: formatDate(lastWeek),
          endDate: formatDate(today),
          dimension: 'overall',
          question: messageText,
        });

        // 保存sessionId
        if (response.session_id) {
          setSessionId(response.session_id);
        }
      } else {
        // 后续消息：继续对话
        response = await aiApiClient.continueConversation({
          sessionId,
          message: messageText,
        });
      }

      // 更新配额
      if (response.quota) {
        setQuotaRemaining(response.quota.remainingQuota);
      }

      // 替换加载消息为实际回复
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                content: response.analysis || '抱歉，未能获取回复',
                isLoading: false,
              }
            : msg
        )
      );
      scrollToBottom();
    } catch (error) {
      console.error('AI 对话失败:', error);

      // 移除加载消息
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessageId));

      // 显示错误提示
      const errorMessage = error instanceof Error ? error.message : t('aiChat.networkError');
      Alert.alert(t('aiChat.sendFailed'), errorMessage, [{ text: t('common.confirm') }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 渲染消息
  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';

    if (message.isLoading) {
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
            {message.timestamp.toLocaleTimeString('zh-CN', {
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
          <View style={styles.aiMessageBubble}>
            <Text style={styles.aiMessageText}>{message.content}</Text>
          </View>
          <Text style={styles.timestamp}>
            {message.timestamp.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
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
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <IconButton icon="chevron-left" size={28} iconColor="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('aiChat.title')}</Text>
        <View style={{ width: 48 }} />
      </View>

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
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
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
});
