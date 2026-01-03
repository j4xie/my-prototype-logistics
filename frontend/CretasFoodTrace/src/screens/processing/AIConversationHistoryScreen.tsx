import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Divider,
  ActivityIndicator,
  Chip,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ProcessingScreenProps } from '../../types/navigation';
import { aiApiClient, ConversationMessage } from '../../services/api/aiApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建AIConversationHistory专用logger
const conversationLogger = logger.createContextLogger('AIConversationHistory');

type AIConversationHistoryScreenProps = ProcessingScreenProps<'AIConversationHistory'>;

/**
 * AI对话历史界面
 *
 * 功能:
 * - 展示完整的AI对话历史记录
 * - 按时间顺序显示用户问题和AI回答
 * - 显示消息时间戳和token消耗
 * - 支持下拉刷新
 * - 区分用户消息和AI消息
 *
 * @version 1.0.0
 * @since 2025-11-05
 */
export default function AIConversationHistoryScreen() {
  const { t } = useTranslation('processing');
  const navigation = useNavigation<AIConversationHistoryScreenProps['navigation']>();
  const route = useRoute<AIConversationHistoryScreenProps['route']>();
  const { user } = useAuthStore();

  const { sessionId } = route.params || {};

  // 状态管理
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 页面加载时获取对话历史
  useEffect(() => {
    if (sessionId) {
      fetchConversationHistory();
    } else {
      Alert.alert(t('common.error') || 'Error', t('aiConversationHistory.missingSessionId'));
      navigation.goBack();
    }
  }, [sessionId]);

  /**
   * 获取对话历史
   */
  const fetchConversationHistory = async () => {
    try {
      setLoading(true);

      const factoryId = user?.factoryUser?.factoryId;
      if (!factoryId || !sessionId) {
        Alert.alert(t('common.error') || 'Error', t('aiConversationHistory.userInfoIncomplete'));
        return;
      }

      conversationLogger.debug('获取AI对话历史', { sessionId, factoryId });

      const response = await aiApiClient.getConversation(sessionId, factoryId);

      if (response) {
        conversationLogger.info('AI对话历史加载成功', {
          sessionId,
          messageCount: response.messages?.length || 0,
          status: response.status,
          factoryId,
        });
        setSessionInfo({
          sessionId: response.sessionId,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
          status: response.status,
          contextBatchId: response.contextBatchId,
        });
        setMessages(response.messages || []);
      }
    } catch (error) {
      conversationLogger.error('获取AI对话历史失败', error as Error, {
        sessionId,
        factoryId: user?.factoryUser?.factoryId,
      });
      Alert.alert(t('aiConversationHistory.loadFailed'), getErrorMsg(error) || t('common.retryLater') || 'Please try again later');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 下拉刷新
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConversationHistory();
    setRefreshing(false);
  };

  /**
   * 关闭会话
   */
  const handleCloseSession = async () => {
    try {
      if (!sessionId) return;

      Alert.alert(
        t('aiConversationHistory.closeConfirmTitle'),
        t('aiConversationHistory.closeConfirmMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.confirm'),
            style: 'destructive',
            onPress: async () => {
              const factoryId = user?.factoryUser?.factoryId;
              if (!factoryId) return;

              await aiApiClient.closeConversation(sessionId, factoryId);
              conversationLogger.info('AI会话已关闭', { sessionId, factoryId });
              Alert.alert(t('common.success') || 'Success', t('aiConversationHistory.closeSuccess'), [
                { text: t('common.ok') || 'OK', onPress: () => navigation.goBack() },
              ]);
            },
          },
        ]
      );
    } catch (error) {
      conversationLogger.error('关闭AI会话失败', error as Error, {
        sessionId,
        factoryId: user?.factoryUser?.factoryId,
      });
      Alert.alert(t('aiConversationHistory.closeFailed'), getErrorMsg(error) || t('common.retryLater') || 'Please try again later');
    }
  };

  /**
   * 格式化时间
   */
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return t('aiConversationHistory.time.justNow');
    if (diffMins < 60) return t('aiConversationHistory.time.minutesAgo', { minutes: diffMins });
    if (diffHours < 24) return t('aiConversationHistory.time.hoursAgo', { hours: diffHours });

    return date.toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 渲染消息气泡
   */
  const renderMessage = ({ item, index }: { item: ConversationMessage; index: number }) => {
    const isUser = item.role === 'user';
    const isFirst = index === 0;
    const isLast = index === messages.length - 1;

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
          isFirst && styles.firstMessage,
          isLast && styles.lastMessage,
        ]}
      >
        {/* 消息气泡 */}
        <Card
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
          mode="elevated"
        >
          <Card.Content style={styles.messageContent}>
            {/* 角色标签 */}
            <View style={styles.messageHeader}>
              <Chip
                icon={isUser ? 'account' : 'robot'}
                mode="outlined"
                compact
                style={[
                  styles.roleChip,
                  isUser ? styles.userRoleChip : styles.assistantRoleChip,
                ]}
                textStyle={[
                  styles.roleChipText,
                  isUser ? styles.userRoleChipText : styles.assistantRoleChipText,
                ]}
              >
                {isUser ? t('aiConversationHistory.role.user') : t('aiConversationHistory.role.assistant')}
              </Chip>
              <Text variant="bodySmall" style={styles.timestamp}>
                {formatTime(item.timestamp)}
              </Text>
            </View>

            {/* 消息内容 */}
            <Text
              variant="bodyMedium"
              style={[
                styles.messageText,
                isUser ? styles.userMessageText : styles.assistantMessageText,
              ]}
            >
              {item.content}
            </Text>

            {/* Token消耗 */}
            {item.tokens !== undefined && item.tokens > 0 && (
              <View style={styles.tokenInfo}>
                <Text variant="bodySmall" style={styles.tokenText}>
                  {t('aiConversationHistory.tokensConsumed', { tokens: item.tokens })}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 顶部导航栏 */}
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('aiConversationHistory.title')} />
        {sessionInfo?.status === 'active' && (
          <Appbar.Action
            icon="close-circle-outline"
            onPress={handleCloseSession}
          />
        )}
      </Appbar.Header>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>{t('aiConversationHistory.loading')}</Text>
        </View>
      ) : (
        <>
          {/* 会话信息卡片 */}
          {sessionInfo && (
            <Card style={styles.sessionCard} mode="outlined">
              <Card.Content>
                <View style={styles.sessionRow}>
                  <View style={styles.sessionInfo}>
                    <Text variant="bodySmall" style={styles.sessionLabel}>{t('aiConversationHistory.sessionId')}</Text>
                    <Text variant="bodyMedium" style={styles.sessionValue} numberOfLines={1}>
                      {sessionInfo.sessionId}
                    </Text>
                  </View>
                  <Chip
                    icon={sessionInfo.status === 'active' ? 'check-circle' : 'close-circle'}
                    mode="flat"
                    compact
                    style={[
                      styles.statusChip,
                      sessionInfo.status === 'active' ? styles.activeChip : styles.closedChip,
                    ]}
                    textStyle={styles.statusChipText}
                  >
                    {sessionInfo.status === 'active' ? t('aiConversationHistory.status.active') : t('aiConversationHistory.status.closed')}
                  </Chip>
                </View>

                {sessionInfo.contextBatchId && (
                  <View style={styles.sessionRow}>
                    <Text variant="bodySmall" style={styles.sessionLabel}>{t('aiConversationHistory.relatedBatch')}</Text>
                    <Text variant="bodyMedium" style={styles.sessionValue}>
                      #{sessionInfo.contextBatchId}
                    </Text>
                  </View>
                )}

                <View style={styles.sessionRow}>
                  <Text variant="bodySmall" style={styles.sessionLabel}>{t('aiConversationHistory.createdAt')}</Text>
                  <Text variant="bodyMedium" style={styles.sessionValue}>
                    {new Date(sessionInfo.createdAt).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.sessionRow}>
                  <Text variant="bodySmall" style={styles.sessionLabel}>{t('aiConversationHistory.messageCount')}</Text>
                  <Text variant="bodyMedium" style={styles.sessionValue}>
                    {messages.length} {t('aiAnalysisDetail.messages')}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* 对话消息列表 */}
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="titleMedium" style={styles.emptyText}>{t('aiConversationHistory.noRecords')}</Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.messageList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              inverted={false}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#757575',
  },
  sessionCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionLabel: {
    color: '#757575',
    fontWeight: '500',
  },
  sessionValue: {
    color: '#424242',
  },
  statusChip: {
    height: 28,
  },
  statusChipText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  activeChip: {
    backgroundColor: '#4CAF50',
  },
  closedChip: {
    backgroundColor: '#9E9E9E',
  },
  messageList: {
    padding: 16,
    paddingBottom: 80,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  firstMessage: {
    marginTop: 0,
  },
  lastMessage: {
    marginBottom: 0,
  },
  messageBubble: {
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: '#E3F2FD',
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
  },
  messageContent: {
    padding: 8,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleChip: {
    height: 24,
  },
  roleChipText: {
    fontSize: 11,
  },
  userRoleChip: {
    borderColor: '#2196F3',
  },
  userRoleChipText: {
    color: '#2196F3',
  },
  assistantRoleChip: {
    borderColor: '#4CAF50',
  },
  assistantRoleChipText: {
    color: '#4CAF50',
  },
  timestamp: {
    color: '#9E9E9E',
    fontSize: 11,
  },
  messageText: {
    lineHeight: 22,
  },
  userMessageText: {
    color: '#1976D2',
  },
  assistantMessageText: {
    color: '#424242',
  },
  tokenInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  tokenText: {
    color: '#757575',
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#9E9E9E',
    textAlign: 'center',
  },
});
