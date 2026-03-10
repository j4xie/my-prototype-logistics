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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { aiService, detectAnalysisMode } from '../../../services/ai';
import type { AnalysisMode } from '../../../services/ai/types';
import { AIModeIndicator } from '../../../components/ai/AIModeIndicator';
import { FeedbackWidget, FoodKBQueryMetadata } from '../../../components/ai/FeedbackWidget';
import { RichContentRenderer, detectRichData, type RichData } from '../../../components/ai/RichContentRenderer';
import { useAuthStore } from '../../../store/authStore';
import { speechRecognitionService } from '../../../services/voice/SpeechRecognitionService';
import { aiApiClient } from '../../../services/api/aiApiClient';
import type { IntentSSECallbacks } from '../../../services/api/aiApiClient';
import type { FAAIStackParamList } from '../../../types/navigation';

// 建议操作类型
interface SuggestedAction {
  label: string;
  value: string;
  description?: string;
}

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
  /** 需要澄清时的建议操作列表 */
  suggestedActions?: SuggestedAction[];
  /** 会话ID (用于多轮对话) */
  sessionIdForReply?: string;
  /** 意图类别（用于判断是否显示反馈组件） */
  intentCategory?: string;
  /** 意图代码（用于反馈追溯） */
  intentCode?: string;
  /** 用户原始问题（用于反馈组件） */
  userQuestion?: string;
  /** 食品知识库查询元数据（用于反馈组件） */
  foodKbMetadata?: FoodKBQueryMetadata;
  /** 结构化数据（用于富组件渲染：表格/卡片/统计） */
  richData?: RichData;
}

type AIChatRouteProp = RouteProp<FAAIStackParamList, 'AIChat'>;

// 场景专属快捷问题和允许的操作 actionCode
const SCENE_CONFIG: Record<string, {
  quickQuestions: string[];
  allowedActionCodes: string[];
}> = {
  PRODUCTION_PLAN: {
    quickQuestions: ['创建生产计划', '查询生产批次', '查看排产进度', '生产效率分析'],
    allowedActionCodes: [
      'PRODUCTION_PLAN_CREATE', 'PROCESSING_BATCH_LIST', 'PRODUCTION_PLAN_QUERY',
      'PRODUCTION_TRACKING', 'REPHRASE', 'SHOW_INTENTS',
    ],
  },
  WORK_REPORT: {
    quickQuestions: ['今日生产汇报', '查询生产批次', '工人出勤情况', '产量统计'],
    allowedActionCodes: [
      'WORK_REPORT_CREATE', 'WORK_REPORT_QUERY', 'PROCESSING_BATCH_LIST',
      'PERSONNEL_QUERY', 'REPHRASE', 'SHOW_INTENTS',
    ],
  },
  QUALITY_CHECK: {
    quickQuestions: ['查看质检任务', '质检数据分析', '不合格批次', '质检标准查询'],
    allowedActionCodes: [
      'QUALITY_CHECK_LIST', 'QUALITY_CHECK_CREATE', 'QUALITY_ANALYSIS',
      'PROCESSING_BATCH_LIST', 'REPHRASE', 'SHOW_INTENTS',
    ],
  },
  SHIPMENT: {
    quickQuestions: ['查询发货记录', '创建发货单', '物流跟踪', '发货统计'],
    allowedActionCodes: [
      'SHIPMENT_QUERY', 'SHIPMENT_CREATE', 'SHIPMENT_LIFECYCLE',
      'REPHRASE', 'SHOW_INTENTS',
    ],
  },
  MATERIAL: {
    quickQuestions: ['查询原料库存', '原料入库记录', '库存预警', '供应商查询'],
    allowedActionCodes: [
      'MATERIAL_BATCH_QUERY', 'MATERIAL_INBOUND_QUERY', 'INVENTORY_ANALYSIS',
      'SUPPLIER_QUERY', 'REPHRASE', 'SHOW_INTENTS',
    ],
  },
};

export default function AIChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<AIChatRouteProp>();
  const { user } = useAuthStore();
  const { t, i18n } = useTranslation('home');
  const scrollViewRef = useRef<ScrollView>(null);

  // 从路由参数获取场景类型
  const params = route.params as Record<string, any> | undefined;
  const entityType = params?.entityType as string | undefined;
  const sceneConfig = entityType ? SCENE_CONFIG[entityType] : undefined;

  // 快捷问题列表：场景专属 > 通用
  const QUICK_QUESTIONS = sceneConfig?.quickQuestions || [
    t('aiChat.question1'),
    t('aiChat.question2'),
    t('aiChat.question3'),
    t('aiChat.question4'),
  ];

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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

  // 从其他页面跳转过来时自动发送初始消息
  const initialMessageSentRef = useRef(false);
  useEffect(() => {
    const params = route.params as Record<string, any> | undefined;
    const initialMsg = params?.initialMessage || params?.initialQuery;
    if (initialMsg && !initialMessageSentRef.current) {
      initialMessageSentRef.current = true;
      // 延迟发送，等待组件完全挂载
      setTimeout(() => {
        handleSend(initialMsg);
      }, 500);
    }
  }, [route.params]);

  // 流式状态文本（显示处理进度）
  const [streamStatus, setStreamStatus] = useState<string | null>(null);

  // 处理建议选项点击
  const handleSuggestedActionClick = async (action: SuggestedAction, messageId: string) => {
    // 处理跳转到生产计划创建表单的特殊action
    if (action.value === 'REDIRECT_TO_PLAN_FORM') {
      const extractedParams = (action as any).params || (action as any).data || {};
      navigation.navigate('ProductionPlanManagement' as any, {
        mode: 'create',
        initialValues: extractedParams,
      });
      return;
    }

    // 清除该消息的建议选项（已选择）
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, suggestedActions: undefined } : msg
      )
    );
    // 发送用户选择作为新消息
    await handleSend(action.label);
  };

  // 语音输入
  const handleVoiceInput = async () => {
    if (isRecording) {
      // 停止录音，获取识别结果
      try {
        const result = await speechRecognitionService.stopListening();
        setIsRecording(false);
        if (result.text?.trim()) {
          setInputText(result.text.trim());
        }
      } catch {
        setIsRecording(false);
      }
    } else {
      // 开始录音
      try {
        setIsRecording(true);
        await speechRecognitionService.startListening();
      } catch {
        setIsRecording(false);
      }
    }
  };

  // 发送消息 — 使用真正的 SSE 流式传输
  const handleSend = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading) return;

    setInputText('');
    setIsLoading(true);
    setStreamStatus(null);

    const startTime = Date.now();

    // 检测分析模式
    const modeResult = detectAnalysisMode(messageText);

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
        userQuestion: messageText,
      },
    ]);
    scrollToBottom();

    // 累积的流式文本
    let streamedContent = '';
    // 收集到的结果数据
    let resultData: Record<string, unknown> | null = null;

    try {
      const factoryId = user?.factoryId || 'F001';

      const callbacks: IntentSSECallbacks = {
        onStart: (message) => {
          setStreamStatus(message);
          console.log('[AI Stream] Start:', message);
        },

        onCacheHit: (data) => {
          setStreamStatus('命中缓存，快速响应...');
          console.log('[AI Stream] Cache hit:', data.cacheType, data.latencyMs + 'ms');
        },

        onCacheMiss: (latencyMs) => {
          console.log('[AI Stream] Cache miss:', latencyMs + 'ms');
        },

        onProgress: (data) => {
          setStreamStatus(data.message || data.stage);
          console.log('[AI Stream] Progress:', data.stage, data.message);
        },

        onIntentRecognized: (data) => {
          setStreamStatus(`识别到: ${data.intentName}`);
          console.log('[AI Stream] Intent:', data.intentCode, data.confidence);
          // 更新消息的意图信息
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, intentCode: data.intentCode }
                : msg
            )
          );
        },

        onExecuting: (intentName) => {
          setStreamStatus(`正在执行: ${intentName}...`);
          console.log('[AI Stream] Executing:', intentName);
        },

        onMeta: (data) => {
          console.log('[AI Stream] Meta:', data.model, data.questionType);
          // 更新分析模式
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    mode: data.questionType === 'GENERAL_QUESTION' ? 'deep' as AnalysisMode : 'quick' as AnalysisMode,
                  }
                : msg
            )
          );
        },

        onToken: (token) => {
          // 逐 token 实时显示 — 这是真正的流式！
          streamedContent += token;
          setStreamStatus(null); // 收到内容后隐藏状态文本
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: streamedContent, isLoading: true }
                : msg
            )
          );
          scrollToBottom();
        },

        onResult: (result) => {
          resultData = result;
          console.log('[AI Stream] Result status:', result.status);

          // 从结果中提取回复文本
          let replyMessage = '';
          const formattedText = result.formattedText as string | undefined;
          const message = result.message as string | undefined;
          const resultInner = result.resultData as Record<string, unknown> | undefined;

          if (formattedText) {
            replyMessage = formattedText;
          } else if (message && message !== '执行成功') {
            replyMessage = message;
          }

          // 追加分析摘要
          if (resultInner) {
            const analysis = (resultInner.analysis || resultInner.summary) as string | undefined;
            if (analysis) {
              replyMessage = replyMessage ? `${replyMessage}\n\n${analysis}` : analysis;
            }
          }

          // 如果有结果文本且没有流式内容，显示结果
          if (replyMessage && !streamedContent) {
            streamedContent = replyMessage;
          }

          // 提取建议操作
          let suggestedActions: SuggestedAction[] = [];
          const status = result.status as string | undefined;

          // NEED_MORE_INFO: 优先使用 clarificationQuestions 构建友好回复
          if (status === 'NEED_MORE_INFO' && Array.isArray(result.clarificationQuestions)
              && (result.clarificationQuestions as string[]).length > 0) {
            const questions = result.clarificationQuestions as string[];
            replyMessage = `为了完成操作，还需要以下信息：\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n请直接告诉我，或点击下方选项。`;
            streamedContent = replyMessage;
          }

          // 重定向到表单
          if (result.actionCode === 'REDIRECT_TO_PLAN_FORM' || result.redirectAction === 'REDIRECT_TO_PLAN_FORM') {
            const params = (result.collectedParams || result.params || {}) as Record<string, unknown>;
            suggestedActions = [{
              label: '前往创建生产计划',
              value: 'REDIRECT_TO_PLAN_FORM',
              description: '使用AI收集的参数预填表单',
              ...({ params } as any),
            }];
          }

          // 澄清建议 / 缺参可选项
          if ((status === 'NEED_CLARIFICATION' || status === 'CONVERSATION_CONTINUE' || status === 'ACTIVE' || status === 'NEED_MORE_INFO')
              && Array.isArray(result.suggestedActions)) {
            suggestedActions = (result.suggestedActions as Array<Record<string, unknown>>).map((action) => ({
              label: (action.actionName || action.label || action.name || action.description) as string,
              value: (action.actionCode || action.value || action.code || action.actionName) as string,
              description: action.description as string | undefined,
            })).filter((a) => a.label && a.value);
          }

          // 候选意图
          if (suggestedActions.length === 0 && Array.isArray(result.candidates) && (result.candidates as unknown[]).length > 0) {
            suggestedActions = (result.candidates as Array<Record<string, unknown>>).map((c) => ({
              label: (c.intentName || c.intentCode) as string,
              value: c.intentCode as string,
              description: c.matchReason as string | undefined,
            })).filter((a) => a.label && a.value);
          }

          // 提取食品知识库元数据
          let foodKbMeta: FoodKBQueryMetadata | undefined;
          if (resultInner?.citations && Array.isArray(resultInner.citations)) {
            foodKbMeta = {
              responseTimeMs: (resultInner.latencyMs as number) || (Date.now() - startTime),
              documentCount: resultInner.documentCount as number,
              citations: (resultInner.citations as Array<Record<string, unknown>>).map(c => ({
                index: (c.index as number) || 0,
                title: (c.title as string) || '',
                source: (c.source as string) || '',
                category: (c.category as string) || '',
                similarity: (c.similarity as number) || 0,
              })),
            };
          }

          // 检测结构化数据用于富组件渲染
          const richData = detectRichData(resultInner);

          // 场景过滤：只保留当前场景允许的建议操作
          if (sceneConfig && suggestedActions.length > 0) {
            suggestedActions = suggestedActions.filter(
              (a) => sceneConfig.allowedActionCodes.includes(a.value)
            );
          }

          // 更新消息
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: streamedContent || replyMessage || t('aiChat.defaultReply'),
                    intentCode: (result.intentCode as string) || msg.intentCode,
                    intentCategory: result.intentCategory as string | undefined,
                    suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
                    foodKbMetadata: foodKbMeta,
                    richData,
                  }
                : msg
            )
          );
        },

        onComplete: (data) => {
          console.log('[AI Stream] Complete:', data.status, data.totalLatencyMs + 'ms');

          // 如果 complete 带有 fullContent 且流式没收到内容，用 fullContent
          if (data.fullContent && !streamedContent) {
            streamedContent = data.fullContent;
          }

          // 最终更新消息状态
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: streamedContent || msg.content || t('aiChat.defaultReply'),
                    isLoading: false,
                    mode: msg.mode || modeResult.mode,
                    responseTimeMs: data.totalLatencyMs || (Date.now() - startTime),
                  }
                : msg
            )
          );
          setStreamStatus(null);
          setIsLoading(false);
          scrollToBottom();
        },

        onError: (message) => {
          console.error('[AI Stream] Error:', message);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: message || t('aiChat.networkError'),
                    isLoading: false,
                  }
                : msg
            )
          );
          setStreamStatus(null);
          setIsLoading(false);
        },
      };

      await aiApiClient.executeIntentStream(messageText, callbacks, factoryId, entityType);

    } catch (error) {
      console.error('AI 对话失败:', error);

      // 如果流式已经有内容，保留已有内容
      if (streamedContent) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isLoading: false, responseTimeMs: Date.now() - startTime }
              : msg
          )
        );
      } else {
        // 无内容时显示错误
        const errorMessage = error instanceof Error ? error.message : t('aiChat.networkError');
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: errorMessage, isLoading: false }
              : msg
          )
        );
      }
      setStreamStatus(null);
      setIsLoading(false);
    }
  };

  // 渲染消息
  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';

    // 流式加载状态：无内容时显示思考动画+进度状态，有内容时显示内容+光标
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
            <Text style={styles.loadingText}>
              {streamStatus || t('aiChat.thinking')}
            </Text>
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
            {/* 结构化数据富组件渲染（表格/卡片/统计） */}
            {!message.isLoading && message.richData && (
              <RichContentRenderer data={message.richData} />
            )}
          </View>
          {/* 显示建议操作按钮 (当需要澄清时) */}
          {!message.isLoading && message.suggestedActions && message.suggestedActions.length > 0 && (
            <View style={styles.suggestedActionsContainer}>
              {message.suggestedActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  testID={`suggested-action-${index}`}
                  style={styles.suggestedActionButton}
                  onPress={() => handleSuggestedActionClick(action, message.id)}
                  disabled={isLoading}
                >
                  <Text style={styles.suggestedActionText}>{action.label}</Text>
                  {/* 只有当 description 与 label 不同时才显示 */}
                  {action.description && action.description !== action.label && (
                    <Text style={styles.suggestedActionDesc}>{action.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
          {/* 显示反馈组件（仅食品知识类意图） */}
          {!message.isLoading &&
            message.intentCategory === 'FOOD_KNOWLEDGE' &&
            message.userQuestion && (
              <FeedbackWidget
                queryId={message.id}
                question={message.userQuestion}
                answer={message.content}
                sessionId={message.sessionIdForReply || sessionId || undefined}
                intentCode={message.intentCode}
                foodKbMetadata={message.foodKbMetadata}
              />
            )}
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
    <SafeAreaView style={styles.container} edges={['top']}>
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
            <TouchableOpacity
              style={[styles.addButton, isRecording && styles.recordingButton]}
              onPress={handleVoiceInput}
              disabled={isLoading}
            >
              <IconButton icon={isRecording ? 'stop' : 'microphone'} size={20} iconColor={isRecording ? '#fff' : '#666'} />
            </TouchableOpacity>
            <View style={styles.inputWrapper}>
              <TextInput
                testID="ai-chat-input"
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
              testID="ai-chat-send-btn"
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
  recordingButton: {
    backgroundColor: '#ef4444',
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
  // 建议操作按钮样式
  suggestedActionsContainer: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestedActionButton: {
    backgroundColor: '#f0f5ff',
    borderWidth: 1,
    borderColor: '#667eea',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
  },
  suggestedActionText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '500',
    textAlign: 'center',
  },
  suggestedActionDesc: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    textAlign: 'center',
  },
});
