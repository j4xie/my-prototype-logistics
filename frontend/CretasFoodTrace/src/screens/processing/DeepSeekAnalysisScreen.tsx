import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Appbar, ActivityIndicator, Chip, TextInput as PaperTextInput } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { aiApiClient, type AICostAnalysisResponse } from '../../services/api/aiApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建DeepSeekAnalysis专用logger
const deepSeekLogger = logger.createContextLogger('DeepSeekAnalysis');

type DeepSeekAnalysisScreenRouteProp = RouteProp<ProcessingStackParamList, 'DeepSeekAnalysis'>;
type DeepSeekAnalysisScreenNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'DeepSeekAnalysis'
>;

/**
 * DeepSeek AI 分析详情页
 * P1-004: AI成本分析
 *
 * 功能：
 * - 调用 aiApiClient.analyzeBatchCost() 获取AI分析
 * - 显示AI文本分析结果
 * - 支持追问（follow-up questions）
 * - 显示配额使用情况
 */
export default function DeepSeekAnalysisScreen() {
  const navigation = useNavigation<DeepSeekAnalysisScreenNavigationProp>();
  const route = useRoute<DeepSeekAnalysisScreenRouteProp>();
  const { batchId } = route.params;

  // Get user context
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // State
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisResponse, setAnalysisResponse] = useState<AICostAnalysisResponse | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  // Follow-up question state
  const [question, setQuestion] = useState('');
  const [showQuestionInput, setShowQuestionInput] = useState(false);

  useEffect(() => {
    loadAnalysis();
  }, [batchId]);

  const loadAnalysis = async () => {
    try {
      setLoading(true);

      deepSeekLogger.debug('加载AI批次分析', { batchId, factoryId });

      // API integration - POST /ai/analysis/cost/batch
      const response = await aiApiClient.analyzeBatchCost(
        {
          batchId: Number(batchId),
          analysisType: 'default', // 默认分析
        },
        factoryId
      );

      deepSeekLogger.info('AI分析加载成功', {
        batchId,
        sessionId: response.session_id,
        hasAnalysis: !!response.analysis,
        quotaRemaining: response.quota?.remaining,
      });

      setAnalysisResponse(response);
      setSessionId(response.session_id || '');
    } catch (error) {
      deepSeekLogger.error('加载AI分析失败', error, {
        batchId,
        factoryId,
        errorStatus: error.response?.status,
      });

      // Handle specific errors
      if (error.response?.status === 429) {
        Alert.alert('配额不足', error.response?.data?.message || '本周AI分析次数已达上限，请下周一再试');
      } else if (error.response?.status === 403) {
        Alert.alert('功能已禁用', 'AI分析功能已被管理员禁用');
      } else {
        const errorMessage = error.response?.data?.message || error.message || '加载AI分析失败，请稍后重试';
        Alert.alert('加载失败', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 追问功能
   */
  const handleAskQuestion = async () => {
    if (!question.trim()) {
      Alert.alert('提示', '请输入问题');
      return;
    }

    if (!sessionId) {
      Alert.alert('提示', '无会话ID，无法追问');
      return;
    }

    try {
      setAiLoading(true);

      deepSeekLogger.debug('AI追问', { batchId, sessionId, questionLength: question.length });

      // API integration - POST /ai/analysis/cost/batch (with sessionId + question)
      const response = await aiApiClient.analyzeBatchCost(
        {
          batchId: Number(batchId),
          question: question.trim(),
          sessionId,
          analysisType: 'default',
        },
        factoryId
      );

      deepSeekLogger.info('AI追问回答成功', {
        batchId,
        sessionId,
        hasAnalysis: !!response.analysis,
      });

      setAnalysisResponse(response);
      setQuestion('');
      setShowQuestionInput(false);
    } catch (error) {
      deepSeekLogger.error('AI追问失败', error, { batchId, sessionId });
      const errorMessage = error.response?.data?.message || error.message || '追问失败，请稍后重试';
      Alert.alert('追问失败', errorMessage);
    } finally {
      setAiLoading(false);
    }
  };

  const handleExport = () => {
    Alert.alert('功能开发中', 'PDF导出功能即将上线（需要后端支持）');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="AI成本分析" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>正在生成AI分析...</Text>
        </View>
      </View>
    );
  }

  if (!analysisResponse || !analysisResponse.success) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="AI成本分析" />
        </Appbar.Header>
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            {analysisResponse?.errorMessage || '暂无分析数据'}
          </Text>
          <Button mode="outlined" onPress={loadAnalysis} style={styles.retryButton}>
            重试
          </Button>
        </View>
      </View>
    );
  }

  const { analysis, quota, cacheHit, responseTimeMs } = analysisResponse;

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="AI成本分析" />
        <Appbar.Action icon="refresh" onPress={loadAnalysis} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* 配额信息 */}
        {quota && (
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <View style={styles.quotaRow}>
                <Text variant="bodyMedium">
                  本周已用: {quota.usedQuota} / {quota.weeklyQuota}
                </Text>
                <Chip
                  mode="flat"
                  style={{
                    backgroundColor:
                      quota.status === 'exhausted'
                        ? '#FFEBEE'
                        : quota.status === 'warning'
                        ? '#FFF3E0'
                        : '#E8F5E9',
                  }}
                  textStyle={{
                    color:
                      quota.status === 'exhausted'
                        ? '#D32F2F'
                        : quota.status === 'warning'
                        ? '#F57C00'
                        : '#388E3C',
                  }}
                >
                  {quota.status === 'exhausted'
                    ? '已用完'
                    : quota.status === 'warning'
                    ? '即将用完'
                    : '充足'}
                </Chip>
              </View>
              {cacheHit && (
                <Text variant="bodySmall" style={styles.cacheHint}>
                  ⚡ 缓存命中，未消耗配额
                </Text>
              )}
              {responseTimeMs && (
                <Text variant="bodySmall" style={styles.responseTime}>
                  响应时间: {responseTimeMs}ms
                </Text>
              )}
            </Card.Content>
          </Card>
        )}

        {/* AI分析内容 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title="DeepSeek AI 分析"
            subtitle={`批次 #${batchId}`}
            left={(props) => <Card.Title {...props} titleStyle={{}} />}
          />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.analysisText}>
              {analysis}
            </Text>
          </Card.Content>
        </Card>

        {/* 追问区域 */}
        {sessionId && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title="追问AI" />
            <Card.Content>
              {!showQuestionInput ? (
                <Button
                  mode="outlined"
                  icon="comment-question"
                  onPress={() => setShowQuestionInput(true)}
                >
                  对分析结果追问
                </Button>
              ) : (
                <View>
                  <PaperTextInput
                    label="输入您的问题"
                    value={question}
                    onChangeText={setQuestion}
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    style={styles.questionInput}
                    placeholder="例如：如何具体降低人工成本？"
                  />
                  <View style={styles.questionActions}>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        setShowQuestionInput(false);
                        setQuestion('');
                      }}
                      style={styles.questionButton}
                    >
                      取消
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleAskQuestion}
                      loading={aiLoading}
                      disabled={aiLoading || !question.trim()}
                      style={styles.questionButton}
                    >
                      提问
                    </Button>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* 操作按钮 */}
        <View style={styles.actionsContainer}>
          <Button
            mode="outlined"
            icon="file-export"
            onPress={handleExport}
            style={styles.actionButton}
          >
            导出报告
          </Button>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// ========== 样式定义 ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginBottom: 16,
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cacheHit: {
    marginTop: 8,
    color: '#4CAF50',
    fontSize: 13,
  },
  responseTime: {
    marginTop: 4,
    color: '#757575',
    fontSize: 12,
  },
  analysisText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#212121',
  },
  questionInput: {
    marginBottom: 12,
  },
  questionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  questionButton: {
    flex: 1,
  },
  actionsContainer: {
    marginTop: 8,
  },
  actionButton: {
    marginTop: 8,
  },
  bottomPadding: {
    height: 80,
  },
});
