import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Appbar, ActivityIndicator, Chip, TextInput as PaperTextInput, IconButton, ProgressBar, Divider, Switch } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { aiApiClient, type AICostAnalysisResponse } from '../../services/api/aiApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建DeepSeekAnalysis专用logger
const deepSeekLogger = logger.createContextLogger('DeepSeekAnalysis');

type DeepSeekAnalysisScreenRouteProp = RouteProp<ProcessingStackParamList, 'DeepSeekAnalysis'>;
type DeepSeekAnalysisScreenNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'DeepSeekAnalysis'
>;

// ========== 数据结构定义 ==========

interface DimensionAnalysis {
  title: string;
  icon: string;
  color: string;
  score?: number; // 0-100
  status: 'excellent' | 'good' | 'warning' | 'critical';
  findings: string[];
  suggestions: string[];
}

interface ParsedAnalysis {
  summary: string;
  dimensions: {
    conversionRate?: DimensionAnalysis;
    laborCost?: DimensionAnalysis;
    equipmentCost?: DimensionAnalysis;
    materialCost?: DimensionAnalysis;
    efficiency?: DimensionAnalysis;
  };
  recommendations: Recommendation[];
  totalSavings?: number;
  confidence?: number;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedSavings?: number;
  implementationDifficulty?: 'easy' | 'medium' | 'hard';
}

// ========== 辅助函数：解析AI文本 ==========

/**
 * 从AI文本中提取结构化分析
 */
function parseAnalysisText(text: string): ParsedAnalysis {
  const lines = text.split('\n').filter(line => line.trim());

  const parsed: ParsedAnalysis = {
    summary: '',
    dimensions: {},
    recommendations: [],
  };

  // 提取总结（前3行或第一段）
  parsed.summary = lines.slice(0, Math.min(3, lines.length)).join('\n');

  // 检测关键词并提取相关内容
  const keywords = {
    conversionRate: ['转换率', '转化率', '出成率', '产出率'],
    laborCost: ['人工成本', '人工费用', '劳动成本', '工资'],
    equipmentCost: ['设备成本', '设备费用', '折旧', '维修'],
    materialCost: ['原料成本', '材料成本', '原材料', '浪费'],
    efficiency: ['效率', '生产效率', '员工效率', '工艺'],
  };

  // 简单的关键词匹配提取
  Object.entries(keywords).forEach(([key, words]) => {
    const relevantLines = lines.filter(line =>
      words.some(word => line.includes(word))
    );

    if (relevantLines.length > 0) {
      const dimension: DimensionAnalysis = {
        title: getDimensionTitle(key),
        icon: getDimensionIcon(key),
        color: getDimensionColor(key),
        status: 'good',
        findings: relevantLines.slice(0, 3),
        suggestions: [],
      };

      // 提取评分（如果有百分比）
      const percentageMatch = relevantLines[0]?.match(/(\d+\.?\d*)%/);
      if (percentageMatch && percentageMatch[1]) {
        const percentage = parseFloat(percentageMatch[1]);
        dimension.score = percentage;
        dimension.status = getStatusFromScore(percentage);
      }

      parsed.dimensions[key as keyof ParsedAnalysis['dimensions']] = dimension;
    }
  });

  // 提取建议（查找"建议"、"推荐"、"优化"等关键词）
  const suggestionLines = lines.filter(line =>
    line.includes('建议') || line.includes('推荐') || line.includes('优化') ||
    line.includes('可以') || line.includes('应该') || line.match(/^\d+[\.、]/)
  );

  parsed.recommendations = suggestionLines.slice(0, 5).map((line, index) => ({
    priority: index < 2 ? 'high' : index < 4 ? 'medium' : 'low',
    title: line.substring(0, 30) + (line.length > 30 ? '...' : ''),
    description: line,
  }));

  // 提取节省金额
  const savingsMatch = text.match(/节省[约大概]?[¥￥]?([\d,]+)/);
  if (savingsMatch && savingsMatch[1]) {
    parsed.totalSavings = parseFloat(savingsMatch[1].replace(/,/g, ''));
  }

  return parsed;
}

function getDimensionTitle(key: string): string {
  const titles: Record<string, string> = {
    conversionRate: '转换率分析',
    laborCost: '人工成本分析',
    equipmentCost: '设备成本分析',
    materialCost: '原料成本分析',
    efficiency: '效率分析',
  };
  return titles[key] || key;
}

function getDimensionIcon(key: string): string {
  const icons: Record<string, string> = {
    conversionRate: 'chart-line',
    laborCost: 'account-multiple',
    equipmentCost: 'cog',
    materialCost: 'package-variant',
    efficiency: 'speedometer',
  };
  return icons[key] || 'information';
}

function getDimensionColor(key: string): string {
  const colors: Record<string, string> = {
    conversionRate: '#2196F3',
    laborCost: '#FF9800',
    equipmentCost: '#9C27B0',
    materialCost: '#4CAF50',
    efficiency: '#F44336',
  };
  return colors[key] || '#757575';
}

function getStatusFromScore(score: number): DimensionAnalysis['status'] {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'warning';
  return 'critical';
}

function getStatusColor(status: DimensionAnalysis['status']): string {
  const colors = {
    excellent: '#4CAF50',
    good: '#8BC34A',
    warning: '#FF9800',
    critical: '#F44336',
  };
  return colors[status];
}

function getPriorityColor(priority: Recommendation['priority']): string {
  const colors = {
    high: '#F44336',
    medium: '#FF9800',
    low: '#2196F3',
  };
  return colors[priority];
}

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

  // 思考模式状态（默认开启）
  const [enableThinking, setEnableThinking] = useState(true);

  // Parse analysis text into structured data
  const parsedAnalysis = useMemo(() => {
    if (!analysisResponse?.analysis) return null;
    return parseAnalysisText(analysisResponse.analysis);
  }, [analysisResponse]);

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
          enableThinking, // 思考模式开关
        },
        factoryId
      );

      deepSeekLogger.info('AI分析加载成功', {
        batchId,
        sessionId: (response as any).session_id,
        hasAnalysis: !!(response as any).analysis,
        quotaRemaining: (response as any).quota?.remaining,
      });

      setAnalysisResponse(response);
      setSessionId((response as any).session_id || '');
    } catch (error) {
      deepSeekLogger.error('加载AI分析失败', error, {
        batchId,
        factoryId,
        errorStatus: (error as any).response?.status,
      });

      // Handle specific errors
      if ((error as any).response?.status === 429) {
        Alert.alert('配额不足', getErrorMsg(error) || '本周AI分析次数已达上限，请下周一再试');
      } else if ((error as any).response?.status === 403) {
        Alert.alert('功能已禁用', 'AI分析功能已被管理员禁用');
      } else {
        const errorMessage = getErrorMsg(error) || '加载AI分析失败，请稍后重试';
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
          enableThinking, // 思考模式开关
        },
        factoryId
      );

      deepSeekLogger.info('AI追问回答成功', {
        batchId,
        sessionId,
        hasAnalysis: !!(response as any).analysis,
      });

      setAnalysisResponse(response);
      setQuestion('');
      setShowQuestionInput(false);
    } catch (error) {
      deepSeekLogger.error('AI追问失败', error, { batchId, sessionId });
      const errorMessage = getErrorMsg(error) || '追问失败，请稍后重试';
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
        {/* 思考模式开关 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.thinkingModeRow}>
              <View style={styles.thinkingModeInfo}>
                <Text variant="titleMedium">深度思考模式</Text>
                <Text variant="bodySmall" style={styles.thinkingModeHint}>
                  {enableThinking ? 'AI会进行深度推理分析，结果更准确' : '普通模式，响应更快'}
                </Text>
              </View>
              <Switch
                value={enableThinking}
                onValueChange={setEnableThinking}
                color="#9C27B0"
              />
            </View>
          </Card.Content>
        </Card>

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

        {/* 综合评价 */}
        {parsedAnalysis?.summary && (
          <Card style={styles.card} mode="elevated">
            <Card.Title
              title="综合评价"
              subtitle={`批次 #${batchId}`}
              left={(props) => <IconButton {...props} icon="robot" iconColor="#9C27B0" />}
            />
            <Card.Content>
              <Text variant="bodyLarge" style={styles.summaryText}>
                {parsedAnalysis.summary}
              </Text>
              {parsedAnalysis.totalSavings && (
                <Chip
                  icon="currency-cny"
                  style={styles.savingsChip}
                  textStyle={styles.savingsText}
                >
                  预计节省 ¥{parsedAnalysis.totalSavings.toLocaleString()}
                </Chip>
              )}
            </Card.Content>
          </Card>
        )}

        {/* 5维分析卡片 */}
        {parsedAnalysis && Object.keys(parsedAnalysis.dimensions).length > 0 && (
          <Card style={styles.card} mode="elevated">
            <Card.Title
              title="5维深度分析"
              subtitle="DeepSeek AI 智能洞察"
              left={(props) => <IconButton {...props} icon="chart-box-multiple" iconColor="#2196F3" />}
            />
            <Card.Content>
              {Object.values(parsedAnalysis.dimensions).map((dimension, index) => (
                <View key={index} style={styles.dimensionCard}>
                  <View style={styles.dimensionHeader}>
                    <View style={styles.dimensionTitleRow}>
                      <IconButton
                        icon={dimension.icon}
                        iconColor={dimension.color}
                        size={24}
                        style={styles.dimensionIcon}
                      />
                      <View style={styles.dimensionTitleContainer}>
                        <Text variant="titleMedium" style={styles.dimensionTitle}>
                          {dimension.title}
                        </Text>
                        <Chip
                          mode="flat"
                          style={{
                            backgroundColor: getStatusColor(dimension.status) + '20',
                          }}
                          textStyle={{
                            color: getStatusColor(dimension.status),
                            fontSize: 12,
                          }}
                        >
                          {dimension.status === 'excellent' ? '优秀' :
                           dimension.status === 'good' ? '良好' :
                           dimension.status === 'warning' ? '需改进' : '严重'}
                        </Chip>
                      </View>
                    </View>
                    {dimension.score !== undefined && (
                      <View style={styles.scoreContainer}>
                        <Text variant="headlineSmall" style={[styles.scoreValue, { color: dimension.color }]}>
                          {dimension.score}
                        </Text>
                        <Text variant="bodySmall" style={styles.scoreLabel}>分</Text>
                      </View>
                    )}
                  </View>

                  {dimension.score !== undefined && (
                    <ProgressBar
                      progress={dimension.score / 100}
                      color={dimension.color}
                      style={styles.progressBar}
                    />
                  )}

                  <Divider style={styles.divider} />

                  {dimension.findings.length > 0 && (
                    <View style={styles.findingsContainer}>
                      <Text variant="labelLarge" style={styles.sectionLabel}>发现</Text>
                      {dimension.findings.map((finding, idx) => (
                        <View key={idx} style={styles.findingItem}>
                          <IconButton icon="circle-small" size={16} style={styles.bulletIcon} />
                          <Text variant="bodyMedium" style={styles.findingText}>
                            {finding}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* 优化建议 */}
        {parsedAnalysis && parsedAnalysis.recommendations.length > 0 && (
          <Card style={styles.card} mode="elevated">
            <Card.Title
              title="优化建议"
              subtitle={`${parsedAnalysis.recommendations.length} 条建议`}
              left={(props) => <IconButton {...props} icon="lightbulb-on" iconColor="#FF9800" />}
            />
            <Card.Content>
              {parsedAnalysis.recommendations.map((recommendation, index) => (
                <View key={index} style={styles.recommendationCard}>
                  <View style={styles.recommendationHeader}>
                    <Chip
                      mode="flat"
                      style={{
                        backgroundColor: getPriorityColor(recommendation.priority) + '20',
                      }}
                      textStyle={{
                        color: getPriorityColor(recommendation.priority),
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      {recommendation.priority === 'high' ? '高优先级' :
                       recommendation.priority === 'medium' ? '中优先级' : '低优先级'}
                    </Chip>
                    {recommendation.estimatedSavings && (
                      <Text variant="bodySmall" style={styles.savingsHint}>
                        节省 ¥{recommendation.estimatedSavings.toLocaleString()}
                      </Text>
                    )}
                  </View>
                  <Text variant="bodyLarge" style={styles.recommendationTitle}>
                    {recommendation.title}
                  </Text>
                  <Text variant="bodyMedium" style={styles.recommendationDesc}>
                    {recommendation.description}
                  </Text>
                  <View style={styles.recommendationActions}>
                    <Button
                      mode="text"
                      icon="check-circle"
                      onPress={() => Alert.alert('功能开发中', '采纳建议功能即将上线')}
                      compact
                    >
                      采纳
                    </Button>
                    <Button
                      mode="text"
                      icon="share-variant"
                      onPress={() => Alert.alert('功能开发中', '分享建议功能即将上线')}
                      compact
                    >
                      分享
                    </Button>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* 原始AI文本（可折叠） */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title="原始AI分析"
            subtitle="点击查看完整文本"
            left={(props) => <IconButton {...props} icon="text-box" />}
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
  emptyText: {
    marginBottom: 16,
    color: '#757575',
  },
  retryButton: {
    marginTop: 8,
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
  thinkingModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thinkingModeInfo: {
    flex: 1,
    marginRight: 16,
  },
  thinkingModeHint: {
    color: '#757575',
    marginTop: 4,
  },
  cacheHint: {
    marginTop: 8,
    color: '#4CAF50',
    fontSize: 13,
  },
  responseTime: {
    marginTop: 4,
    color: '#757575',
    fontSize: 12,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#212121',
    marginBottom: 16,
  },
  savingsChip: {
    backgroundColor: '#E8F5E9',
    alignSelf: 'flex-start',
  },
  savingsText: {
    color: '#388E3C',
    fontWeight: '600',
    fontSize: 15,
  },
  dimensionCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dimensionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dimensionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dimensionIcon: {
    margin: 0,
    marginRight: 8,
  },
  dimensionTitleContainer: {
    flex: 1,
    gap: 8,
  },
  dimensionTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  scoreContainer: {
    alignItems: 'center',
    marginLeft: 12,
  },
  scoreValue: {
    fontWeight: '700',
    fontSize: 32,
  },
  scoreLabel: {
    color: '#757575',
    marginTop: -4,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  divider: {
    marginVertical: 12,
  },
  findingsContainer: {
    gap: 8,
  },
  sectionLabel: {
    color: '#424242',
    marginBottom: 4,
    fontWeight: '600',
  },
  findingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: -8,
  },
  bulletIcon: {
    margin: 0,
    marginRight: 4,
  },
  findingText: {
    flex: 1,
    lineHeight: 22,
    color: '#424242',
  },
  recommendationCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  savingsHint: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  recommendationTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  recommendationDesc: {
    lineHeight: 22,
    color: '#616161',
    marginBottom: 12,
  },
  recommendationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
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
