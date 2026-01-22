/**
 * SmartBI - AI Query Screen (Natural Language Query)
 *
 * Provides a conversational interface for querying business data
 * using natural language.
 *
 * Features:
 * - Chat-style interface (FlatList)
 * - Text input with send button
 * - Quick question buttons
 * - Response cards (text + charts)
 * - Conversation history
 *
 * @version 1.0.0
 * @since 2026-01-18
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Text, Card, ActivityIndicator, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';
import { SmartBIStackParamList } from '../../types/smartbi';

// Type for MaterialCommunityIcons names
type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Theme colors for SmartBI
const SMARTBI_THEME = {
  primary: '#4F46E5',
  secondary: '#7C3AED',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  background: '#F5F7FA',
  cardBackground: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
};

// Message types
type MessageType = 'user' | 'assistant' | 'system';

// Chart type in response
interface ChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: Array<{ label: string; value: number }>;
}

// Message interface
interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  chart?: ChartData;
  suggestions?: string[];
  isLoading?: boolean;
}

// Quick questions
interface QuickQuestion {
  id: string;
  text: string;
  icon: MaterialCommunityIconName;
}

type NLQueryRouteProp = RouteProp<SmartBIStackParamList, 'NLQuery'>;

// Message Bubble Component
interface MessageBubbleProps {
  message: Message;
  onSuggestionPress?: (text: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onSuggestionPress }) => {
  const isUser = message.type === 'user';

  // Simple bar chart renderer
  const renderChart = (chart: ChartData) => {
    const maxValue = Math.max(...chart.data.map((d) => d.value), 1);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{chart.title}</Text>
        {chart.data.slice(0, 5).map((item, index) => (
          <View key={index} style={styles.chartItem}>
            <Text style={styles.chartLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={styles.chartBarContainer}>
              <View
                style={[
                  styles.chartBar,
                  { width: `${(item.value / maxValue) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.chartValue}>{item.value.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (message.isLoading) {
    return (
      <View style={[styles.messageBubble, styles.assistantBubble]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={SMARTBI_THEME.primary} />
          <Text style={styles.loadingText}>正在思考...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.messageContainer, isUser && styles.userMessageContainer]}>
      {!isUser && (
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="robot" size={20} color={SMARTBI_THEME.primary} />
        </View>
      )}
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, isUser && styles.userMessageText]}>
          {message.content}
        </Text>

        {/* Chart visualization */}
        {message.chart && renderChart(message.chart)}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>您可能还想问:</Text>
            {message.suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => onSuggestionPress?.(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      {isUser && (
        <View style={styles.userAvatarContainer}>
          <MaterialCommunityIcons name="account" size={20} color="#fff" />
        </View>
      )}
    </View>
  );
};

// Quick Question Button Component
interface QuickQuestionButtonProps {
  question: QuickQuestion;
  onPress: () => void;
}

const QuickQuestionButton: React.FC<QuickQuestionButtonProps> = ({ question, onPress }) => (
  <TouchableOpacity style={styles.quickQuestionButton} onPress={onPress}>
    <MaterialCommunityIcons
      name={question.icon}
      size={18}
      color={SMARTBI_THEME.primary}
    />
    <Text style={styles.quickQuestionText}>{question.text}</Text>
  </TouchableOpacity>
);

export function NLQueryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const route = useRoute<NLQueryRouteProp>();
  const { initialQuery } = route.params || {};
  const { getFactoryId } = useAuthStore();
  const { t } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);

  const flatListRef = useRef<FlatList>(null);

  // Quick questions
  const QUICK_QUESTIONS: QuickQuestion[] = [
    { id: '1', text: '本月销售额是多少?', icon: 'currency-cny' },
    { id: '2', text: '哪个部门业绩最好?', icon: 'podium-gold' },
    { id: '3', text: '本周订单完成率如何?', icon: 'check-circle' },
    { id: '4', text: '利润同比增长情况', icon: 'trending-up' },
  ];

  // Welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      type: 'assistant',
      content: t('nlQuery.welcome', {
        defaultValue: '您好!我是智能分析助手,可以帮您查询销售数据、分析业绩趋势、生成报表等。请问有什么可以帮您的?',
      }),
      timestamp: new Date(),
      suggestions: ['查看今日销售概况', '本月业绩排行', '利润趋势分析'],
    };
    setMessages([welcomeMessage]);
  }, [t]);

  // Handle initial query from navigation params
  useEffect(() => {
    if (initialQuery) {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: Message = {
        id: `user_${Date.now()}`,
        type: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };

      const loadingMessage: Message = {
        id: `loading_${Date.now()}`,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMessage, loadingMessage]);
      setInputText('');
      setIsLoading(true);
      Keyboard.dismiss();

      try {
        const factoryId = getFactoryId();

        const response = await smartBIApiClient.query({
          query: text.trim(),
          sessionId,
          factoryId: factoryId || undefined,
        });

        // Remove loading message
        setMessages((prev) => prev.filter((m) => !m.isLoading));

        if (response.success && response.data) {
          const assistantMessage: Message = {
            id: `assistant_${Date.now()}`,
            type: 'assistant',
            content: response.data.responseText,
            timestamp: new Date(),
            chart: response.data.chartData,
            suggestions: response.data.suggestions,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          const errorMessage: Message = {
            id: `error_${Date.now()}`,
            type: 'assistant',
            content: response.message || t('nlQuery.error', { defaultValue: '抱歉,处理您的请求时出现了问题,请稍后再试。' }),
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } catch (error) {
        console.error('Query failed:', error);

        // Remove loading message
        setMessages((prev) => prev.filter((m) => !m.isLoading));

        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          type: 'assistant',
          content: t('nlQuery.error', { defaultValue: '抱歉,处理您的请求时出现了问题,请稍后再试。' }),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId, getFactoryId, t]
  );

  const handleQuickQuestion = useCallback(
    (question: QuickQuestion) => {
      handleSendMessage(question.text);
    },
    [handleSendMessage]
  );

  const handleSuggestionPress = useCallback(
    (text: string) => {
      handleSendMessage(text);
    },
    [handleSendMessage]
  );

  const handleClearHistory = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        type: 'assistant',
        content: t('nlQuery.welcome', {
          defaultValue: '您好!我是智能分析助手,可以帮您查询销售数据、分析业绩趋势、生成报表等。请问有什么可以帮您的?',
        }),
        timestamp: new Date(),
        suggestions: ['查看今日销售概况', '本月业绩排行', '利润趋势分析'],
      },
    ]);
  }, [t]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble message={item} onSuggestionPress={handleSuggestionPress} />
    ),
    [handleSuggestionPress]
  );

  const renderEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <View style={styles.quickQuestionsGrid}>
          {QUICK_QUESTIONS.map((question) => (
            <QuickQuestionButton
              key={question.id}
              question={question}
              onPress={() => handleQuickQuestion(question)}
            />
          ))}
        </View>
      </View>
    ),
    [handleQuickQuestion]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="robot" size={24} color={SMARTBI_THEME.primary} />
          <Text style={styles.headerTitle}>
            {t('nlQuery.title', { defaultValue: 'AI 问答' })}
          </Text>
        </View>
        <IconButton
          icon="delete-outline"
          size={24}
          onPress={handleClearHistory}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          ListHeaderComponent={
            messages.length === 1 ? (
              <View style={styles.quickQuestionsSection}>
                <Text style={styles.quickQuestionsTitle}>
                  {t('nlQuery.quickQuestions', { defaultValue: '快捷问题' })}
                </Text>
                <View style={styles.quickQuestionsGrid}>
                  {QUICK_QUESTIONS.map((question) => (
                    <QuickQuestionButton
                      key={question.id}
                      question={question}
                      onPress={() => handleQuickQuestion(question)}
                    />
                  ))}
                </View>
              </View>
            ) : null
          }
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder={t('nlQuery.placeholder', { defaultValue: '输入您的问题...' })}
              placeholderTextColor={SMARTBI_THEME.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isLoading}
              onSubmitEditing={() => handleSendMessage(inputText)}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
              ]}
              onPress={() => handleSendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialCommunityIcons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.inputHint}>
            {t('nlQuery.hint', { defaultValue: '按回车发送，支持自然语言查询' })}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SMARTBI_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SMARTBI_THEME.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SMARTBI_THEME.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userAvatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SMARTBI_THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: SMARTBI_THEME.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: SMARTBI_THEME.textPrimary,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: SMARTBI_THEME.textSecondary,
  },
  chartContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: SMARTBI_THEME.background,
    borderRadius: 8,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    marginBottom: 12,
  },
  chartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartLabel: {
    width: 60,
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
  },
  chartBarContainer: {
    flex: 1,
    height: 16,
    backgroundColor: SMARTBI_THEME.border,
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  chartBar: {
    height: '100%',
    backgroundColor: SMARTBI_THEME.primary,
    borderRadius: 4,
  },
  chartValue: {
    width: 60,
    fontSize: 12,
    fontWeight: '500',
    color: SMARTBI_THEME.textPrimary,
    textAlign: 'right',
  },
  suggestionsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SMARTBI_THEME.border,
  },
  suggestionsLabel: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    marginBottom: 8,
  },
  suggestionChip: {
    backgroundColor: SMARTBI_THEME.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: SMARTBI_THEME.primary + '30',
  },
  suggestionText: {
    fontSize: 13,
    color: SMARTBI_THEME.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  quickQuestionsSection: {
    marginBottom: 16,
  },
  quickQuestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SMARTBI_THEME.textSecondary,
    marginBottom: 12,
  },
  quickQuestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SMARTBI_THEME.cardBackground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: SMARTBI_THEME.border,
  },
  quickQuestionText: {
    fontSize: 13,
    color: SMARTBI_THEME.textPrimary,
  },
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SMARTBI_THEME.border,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: SMARTBI_THEME.background,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: SMARTBI_THEME.textPrimary,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SMARTBI_THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: SMARTBI_THEME.textMuted,
  },
  inputHint: {
    fontSize: 11,
    color: SMARTBI_THEME.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default NLQueryScreen;
