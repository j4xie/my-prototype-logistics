/**
 * AI布局助手组件
 * AI Layout Assistant Component
 *
 * 功能：
 * - 风格预设选择
 * - 快捷指令
 * - 自由输入框
 * - AI响应预览
 * - 多轮对话模式
 *
 * @version 1.0.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { decorationApiClient } from '../../../../services/api/decorationApiClient';
import { useHomeLayoutStore } from '../../../../store/homeLayoutStore';
import type {
  HomeModule,
  ThemeConfig,
  AILayoutGenerateResponse,
} from '../../../../types/decoration';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.85;

// ============================================
// 类型定义
// ============================================

export interface AILayoutAssistantProps {
  /** 工厂ID */
  factoryId: string;
  /** 是否可见 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 应用布局回调 */
  onApplyLayout: (modules: HomeModule[], theme?: ThemeConfig) => void;
}

/** 风格预设 */
interface StylePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  gradient: [string, string];
}

/** 快捷指令 */
interface QuickCommand {
  id: string;
  label: string;
  prompt: string;
}

/** 对话消息 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  layout?: HomeModule[];
  theme?: ThemeConfig;
  suggestions?: string[];
  needsClarification?: boolean;
  clarificationQuestions?: string[];
}

// ============================================
// 常量配置
// ============================================

/** 风格预设列表 */
const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'minimal',
    name: '简洁高效',
    description: '突出核心指标，减少视觉干扰',
    icon: 'view-dashboard-outline',
    gradient: ['#667eea', '#764ba2'],
  },
  {
    id: 'data-intensive',
    name: '数据密集',
    description: '展示更多数据和统计信息',
    icon: 'chart-bar',
    gradient: ['#11998e', '#38ef7d'],
  },
  {
    id: 'action-focused',
    name: '操作优先',
    description: '快捷操作放在显眼位置',
    icon: 'cursor-default-click',
    gradient: ['#f093fb', '#f5576c'],
  },
];

/** 快捷指令列表 */
const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: 'stats-top',
    label: '把统计放到最上面',
    prompt: '把统计网格模块移动到页面最顶部，作为第一个显示的模块',
  },
  {
    id: 'hide-dev',
    label: '隐藏开发者工具',
    prompt: '隐藏开发者工具模块，不在首页显示',
  },
  {
    id: 'enlarge-ai',
    label: '放大AI洞察卡片',
    prompt: '放大AI洞察卡片，让它占据更大的空间，更突出显示',
  },
  {
    id: 'compact-mode',
    label: '紧凑模式',
    prompt: '让所有模块更紧凑，减少空白间距，在一屏内显示更多信息',
  },
];

// ============================================
// 辅助组件
// ============================================

/** 风格预设卡片 */
function StylePresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: StylePreset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.presetCard, selected && styles.presetCardSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={preset.gradient}
        style={styles.presetIconWrapper}
      >
        <IconButton icon={preset.icon} size={24} iconColor="#fff" />
      </LinearGradient>
      <View style={styles.presetContent}>
        <Text style={styles.presetName}>{preset.name}</Text>
        <Text style={styles.presetDescription}>{preset.description}</Text>
      </View>
      {selected && (
        <View style={styles.presetCheckmark}>
          <IconButton icon="check-circle" size={24} iconColor="#667eea" />
        </View>
      )}
    </TouchableOpacity>
  );
}

/** 快捷指令按钮 */
function QuickCommandButton({
  command,
  onPress,
  disabled,
}: {
  command: QuickCommand;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.quickCommandButton, disabled && styles.quickCommandButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.quickCommandText, disabled && styles.quickCommandTextDisabled]}>
        {command.label}
      </Text>
    </TouchableOpacity>
  );
}

/** 打字机效果文本 */
function TypewriterText({
  text,
  onComplete,
}: {
  text: string;
  onComplete?: () => void;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayedText('');
    indexRef.current = 0;

    const timer = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.substring(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(timer);
        onComplete?.();
      }
    }, 20);

    return () => clearInterval(timer);
  }, [text, onComplete]);

  return (
    <Text style={styles.messageText}>
      {displayedText}
      {displayedText.length < text.length && (
        <Text style={styles.cursor}>|</Text>
      )}
    </Text>
  );
}

/** 布局预览卡片 */
function LayoutPreviewCard({
  modules,
  theme,
  onApply,
  onCancel,
}: {
  modules: HomeModule[];
  theme?: ThemeConfig;
  onApply: () => void;
  onCancel: () => void;
}) {
  const visibleModules = modules.filter((m) => m.visible).sort((a, b) => a.order - b.order);

  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewTitle}>布局预览</Text>
      <View style={styles.previewContent}>
        {visibleModules.map((module, index) => (
          <View
            key={module.id}
            style={[
              styles.previewModule,
              {
                width: module.gridSize.w === 2 ? '100%' : '48%',
                backgroundColor: theme?.cardBackgroundColor || '#f0f0f0',
              },
            ]}
          >
            <Text style={styles.previewModuleName}>{module.name}</Text>
            <Text style={styles.previewModuleType}>{module.type}</Text>
          </View>
        ))}
      </View>
      <View style={styles.previewActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={onApply}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.applyButtonGradient}
          >
            <Text style={styles.applyButtonText}>应用布局</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** 澄清问题组件 */
function ClarificationQuestions({
  questions,
  onAnswer,
}: {
  questions: string[];
  onAnswer: (answer: string) => void;
}) {
  return (
    <View style={styles.clarificationContainer}>
      <Text style={styles.clarificationTitle}>请补充以下信息：</Text>
      {questions.map((question, index) => (
        <TouchableOpacity
          key={index}
          style={styles.clarificationQuestion}
          onPress={() => onAnswer(question)}
        >
          <IconButton icon="help-circle" size={18} iconColor="#667eea" />
          <Text style={styles.clarificationQuestionText}>{question}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ============================================
// 主组件
// ============================================

export function AILayoutAssistant({
  factoryId,
  visible,
  onClose,
  onApplyLayout,
}: AILayoutAssistantProps) {
  // 动画值
  const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;

  // 状态
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [pendingLayout, setPendingLayout] = useState<{
    modules: HomeModule[];
    theme?: ThemeConfig;
  } | null>(null);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Store
  const { draftModules, draftTheme } = useHomeLayoutStore();

  // 生成消息ID
  const generateMessageId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // 显示/隐藏动画
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: MODAL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // 重置状态
  useEffect(() => {
    if (visible) {
      setMessages([]);
      setSelectedPreset(null);
      setInputText('');
      setPendingLayout(null);
      setIsExpanded(true);
    }
  }, [visible]);

  // 发送消息到AI
  const sendMessage = async (prompt: string, stylePreference?: string) => {
    if (isLoading) return;

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    scrollToBottom();

    // 添加AI加载消息
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

    setIsLoading(true);

    try {
      const response = await decorationApiClient.generateLayoutWithAI(factoryId, {
        prompt,
        currentLayout: draftModules,
        stylePreference: stylePreference || selectedPreset || undefined,
        factoryId,
      });

      if (response.success && response.data) {
        const aiResponse = response.data;

        // 更新AI消息
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: aiResponse.explanation || '布局已生成，请查看预览。',
                  isLoading: false,
                  layout: aiResponse.layout,
                  theme: aiResponse.theme,
                  suggestions: aiResponse.suggestions,
                  needsClarification: aiResponse.needsClarification,
                  clarificationQuestions: aiResponse.clarificationQuestions,
                }
              : msg
          )
        );

        // 如果有生成的布局，设置为待应用
        if (aiResponse.layout && aiResponse.layout.length > 0) {
          setPendingLayout({
            modules: aiResponse.layout,
            theme: aiResponse.theme,
          });
        }
      } else {
        // 错误处理
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: response.message || '抱歉，生成布局时遇到问题，请稍后重试。',
                  isLoading: false,
                }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('[AILayoutAssistant] 生成布局失败:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: '网络连接失败，请检查网络后重试。',
                isLoading: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // 处理风格预设选择
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = STYLE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      sendMessage(`使用"${preset.name}"风格重新设计首页布局。${preset.description}`, presetId);
    }
  };

  // 处理快捷指令
  const handleQuickCommand = (command: QuickCommand) => {
    sendMessage(command.prompt);
  };

  // 处理输入发送
  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    sendMessage(text);
  };

  // 处理建议点击
  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  // 处理澄清问题回答
  const handleClarificationAnswer = (question: string) => {
    // 将问题作为用户的回答发送
    sendMessage(question);
  };

  // 应用布局
  const handleApplyLayout = () => {
    if (pendingLayout) {
      onApplyLayout(pendingLayout.modules, pendingLayout.theme);
      setPendingLayout(null);
      onClose();
    }
  };

  // 取消预览
  const handleCancelPreview = () => {
    setPendingLayout(null);
  };

  // 切换展开/收起
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // 渲染消息
  const renderMessage = (message: ChatMessage) => {
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
            <Text style={styles.loadingText}>AI正在思考...</Text>
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
        </View>
      );
    }

    return (
      <View key={message.id} style={styles.messageContainer}>
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
            <TypewriterText text={message.content} />
          </View>
        </View>

        {/* 澄清问题 */}
        {message.needsClarification && message.clarificationQuestions && (
          <ClarificationQuestions
            questions={message.clarificationQuestions}
            onAnswer={handleClarificationAnswer}
          />
        )}

        {/* 建议 */}
        {message.suggestions && message.suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>你可能还想：</Text>
            <View style={styles.suggestionsList}>
              {message.suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionClick(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* 头部 */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.dragHandle} onPress={toggleExpand}>
              <View style={styles.dragHandleBar} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.headerIcon}
                >
                  <IconButton icon="palette" size={24} iconColor="#fff" />
                </LinearGradient>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>AI布局助手</Text>
                  <Text style={styles.headerSubtitle}>
                    用自然语言描述你想要的布局
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose}>
                <IconButton icon="close" size={24} iconColor="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            {isExpanded && (
              <>
                {/* 对话区域 */}
                <ScrollView
                  ref={scrollViewRef}
                  style={styles.chatContainer}
                  contentContainerStyle={styles.chatContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* 空状态 - 显示预设和快捷指令 */}
                  {messages.length === 0 && (
                    <>
                      {/* 风格预设 */}
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>选择风格预设</Text>
                        {STYLE_PRESETS.map((preset) => (
                          <StylePresetCard
                            key={preset.id}
                            preset={preset}
                            selected={selectedPreset === preset.id}
                            onSelect={() => handlePresetSelect(preset.id)}
                          />
                        ))}
                      </View>

                      {/* 快捷指令 */}
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>快捷指令</Text>
                        <View style={styles.quickCommandsGrid}>
                          {QUICK_COMMANDS.map((command) => (
                            <QuickCommandButton
                              key={command.id}
                              command={command}
                              onPress={() => handleQuickCommand(command)}
                              disabled={isLoading}
                            />
                          ))}
                        </View>
                      </View>
                    </>
                  )}

                  {/* 对话消息 */}
                  {messages.map(renderMessage)}

                  {/* 布局预览 */}
                  {pendingLayout && (
                    <LayoutPreviewCard
                      modules={pendingLayout.modules}
                      theme={pendingLayout.theme}
                      onApply={handleApplyLayout}
                      onCancel={handleCancelPreview}
                    />
                  )}
                </ScrollView>

                {/* 输入区域 */}
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      ref={inputRef}
                      style={styles.input}
                      value={inputText}
                      onChangeText={setInputText}
                      placeholder="描述你想要的布局..."
                      placeholderTextColor="#999"
                      multiline
                      maxLength={500}
                      editable={!isLoading}
                      onSubmitEditing={handleSend}
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (isLoading || !inputText.trim()) && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSend}
                    disabled={isLoading || !inputText.trim()}
                  >
                    <LinearGradient
                      colors={
                        isLoading || !inputText.trim()
                          ? ['#ccc', '#ccc']
                          : ['#667eea', '#764ba2']
                      }
                      style={styles.sendButtonGradient}
                    >
                      <IconButton icon="send" size={18} iconColor="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ============================================
// 样式
// ============================================

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: MODAL_HEIGHT,
    minHeight: 200,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  keyboardAvoid: {
    flex: 1,
  },

  // 头部
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },

  // 对话区域
  chatContainer: {
    flex: 1,
    maxHeight: MODAL_HEIGHT - 200,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
  },

  // 分区
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },

  // 风格预设卡片
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f0f4ff',
  },
  presetIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetContent: {
    flex: 1,
    marginLeft: 12,
  },
  presetName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  presetDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  presetCheckmark: {
    marginLeft: 8,
  },

  // 快捷指令
  quickCommandsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickCommandButton: {
    backgroundColor: '#f0f4ff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  quickCommandButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  quickCommandText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '500',
  },
  quickCommandTextDisabled: {
    color: '#999',
  },

  // 消息
  messageContainer: {
    marginBottom: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
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
  aiMessageBubble: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderTopLeftRadius: 0,
    padding: 12,
    maxWidth: '85%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  userMessageBubble: {
    borderRadius: 12,
    borderTopRightRadius: 0,
    padding: 12,
    maxWidth: '75%',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  userMessageText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  cursor: {
    color: '#667eea',
    fontWeight: '300',
  },
  loadingText: {
    fontSize: 13,
    color: '#667eea',
    marginLeft: 8,
  },

  // 澄清问题
  clarificationContainer: {
    backgroundColor: '#fff7e6',
    borderRadius: 12,
    padding: 12,
    marginLeft: 46,
    marginTop: 8,
  },
  clarificationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d48806',
    marginBottom: 8,
  },
  clarificationQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  clarificationQuestionText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },

  // 建议
  suggestionsContainer: {
    marginLeft: 46,
    marginTop: 8,
  },
  suggestionsTitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestionText: {
    fontSize: 12,
    color: '#666',
  },

  // 布局预览
  previewCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  previewContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  previewModule: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  previewModuleName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  previewModuleType: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  applyButton: {
    flex: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },

  // 输入区域
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    minHeight: 40,
    maxHeight: 100,
  },
  input: {
    fontSize: 14,
    color: '#333',
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AILayoutAssistant;
