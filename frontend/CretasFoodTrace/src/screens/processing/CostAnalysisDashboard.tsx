import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TextInput as RNTextInput } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Button,
  ActivityIndicator,
  Divider,
  IconButton,
  TextInput,
  Chip,
} from 'react-native-paper';
import { isAxiosError } from 'axios';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { processingApiClient } from '../../services/api/processingApiClient';
import { aiApiClient } from '../../services/api/aiApiClient';
import type { AIQuota } from '../../types/processing';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建CostAnalysisDashboard专用logger
const costAnalysisLogger = logger.createContextLogger('CostAnalysisDashboard');

// 后端实际返回的数据结构
interface BackendBatchCostData {
  batch: {
    batchNumber: string;
    productName: string;
    actualQuantity?: number;
    goodQuantity?: number;
    defectQuantity?: number;
    yieldRate?: number;
    startTime?: string;
    endTime?: string;
    status?: string;
  };
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  otherCost: number;
  totalCost: number;
  unitCost: number;
  materialCostRatio?: number;
  laborCostRatio?: number;
  equipmentCostRatio?: number;
  otherCostRatio?: number;
}

type CostAnalysisDashboardProps = ProcessingScreenProps<'CostAnalysisDashboard'>;

/**
 * 成本分析仪表板 - 完整版（含AI智能分析）
 */
export default function CostAnalysisDashboard() {
  const navigation = useNavigation<CostAnalysisDashboardProps['navigation']>();
  const route = useRoute<CostAnalysisDashboardProps['route']>();
  const { batchId } = route.params || {};

  // 成本数据状态 - 使用后端实际返回的数据结构
  const [costData, setCostData] = useState<BackendBatchCostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // AI分析状态
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiSessionId, setAiSessionId] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiSection, setShowAiSection] = useState(false);
  const [quota, setQuota] = useState<AIQuota | null>(null);

  // 自定义问题状态
  const [customQuestion, setCustomQuestion] = useState('');
  const [showQuestionInput, setShowQuestionInput] = useState(false);

  // 加载成本数据
  useEffect(() => {
    if (batchId) {
      loadCostData();
    }
  }, [batchId]);

  const loadCostData = async () => {
    if (!batchId) {
      Alert.alert('提示', '请先选择批次');
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);
      const response = await processingApiClient.getBatchCostAnalysis(batchId);
      if (response.success && response.data) {
        // 后端返回的是扁平结构，直接使用
        setCostData(response.data as unknown as BackendBatchCostData);
      }
    } catch (error) {
      costAnalysisLogger.error('加载成本数据失败', error, { batchId });
      Alert.alert('错误', '加载成本数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCostData();
    setRefreshing(false);
  };

  /**
   * AI分析（仅点击按钮时调用）
   *
   * 🔄 已迁移到新的统一AI API: aiApiClient.analyzeBatchCost()
   */
  const handleAiAnalysis = async (question?: string) => {
    if (!batchId) return;

    setAiLoading(true);
    setShowAiSection(true); // 显示AI区域

    try {
      // 使用新的统一AI API
      const response = await aiApiClient.analyzeBatchCost({
        batchId: Number(batchId),
        question: question || undefined,
        sessionId: aiSessionId || undefined,
        analysisType: 'default',
      });

      if (response.success) {
        setAiAnalysis(response.analysis);
        setAiSessionId(response.session_id || '');
        if (response.quota) {
          // ✅ 转换AIQuotaInfo为AIQuota格式 (2025-11-20)
          setQuota({
            used: response.quota.usedQuota,
            limit: response.quota.weeklyQuota,
            remaining: response.quota.remainingQuota,
            period: 'weekly',
            resetDate: response.quota.resetDate,
          });
        }
      }
    } catch (err: unknown) {
      // ✅ 修复: 使用unknown类型代替any (2025-11-20)
      const error = err instanceof Error ? err : new Error(String(err));
      costAnalysisLogger.error('AI分析失败', error, { batchId, hasQuestion: !!question });

      // 处理429错误（超限）
      if (isAxiosError(err) && err.response?.status === 429) {
        Alert.alert('使用上限', err.response?.data?.message || '本周AI分析次数已达上限，请下周一再试');
      } else if (isAxiosError(err) && err.response?.status === 403) {
        Alert.alert('功能已禁用', 'AI分析功能已被工厂管理员禁用');
      } else {
        Alert.alert('错误', 'AI分析失败，请稍后重试');
      }
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * 自定义问题分析
   */
  const handleCustomQuestion = async () => {
    if (!customQuestion.trim()) {
      Alert.alert('提示', '请输入问题');
      return;
    }

    await handleAiAnalysis(customQuestion);
    setCustomQuestion('');
    setShowQuestionInput(false);
  };

  /**
   * 快速提问
   */
  const quickQuestions = [
    '如何降低人工成本？',
    '设备利用率如何优化？',
    '如何提高利润率？',
  ];

  /**
   * 获取重置时间文本
   */
  const getResetText = (resetDate: string) => {
    const reset = new Date(resetDate);
    const now = new Date();
    const days = Math.ceil((reset.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (days === 0) return '明日重置';
    if (days === 1) return '1天后重置';
    return `${days}天后重置`;
  };

  // 加载状态
  if (loading && !costData) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="成本分析" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载成本数据中...</Text>
        </View>
      </View>
    );
  }

  // 无数据状态
  if (!costData) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="成本分析" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>未找到成本数据</Text>
          <Button mode="outlined" onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
            返回
          </Button>
        </View>
      </View>
    );
  }

  // 从后端扁平结构中提取数据
  const { batch } = costData;
  const materialCost = costData.materialCost ?? 0;
  const laborCost = costData.laborCost ?? 0;
  const equipmentCost = costData.equipmentCost ?? 0;
  const otherCost = costData.otherCost ?? 0;
  const totalCost = costData.totalCost ?? 0;
  const unitCost = costData.unitCost ?? 0;
  const materialCostRatio = costData.materialCostRatio ?? 0;
  const laborCostRatio = costData.laborCostRatio ?? 0;
  const equipmentCostRatio = costData.equipmentCostRatio ?? 0;

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="成本分析" />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 批次信息卡片 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.batchHeader}>
              <View>
                <Text variant="bodySmall" style={styles.label}>
                  批次号
                </Text>
                <Text variant="titleLarge" style={styles.batchNumber}>
                  {batch.batchNumber}
                </Text>
              </View>
              <Chip mode="flat">{batch.status ?? '进行中'}</Chip>
            </View>
            <Text variant="bodyMedium" style={styles.productInfo}>
              {batch.productName}
            </Text>
          </Card.Content>
        </Card>

        {/* 成本概览 - 4格网格 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="成本概览" />
          <Card.Content>
            <View style={styles.costGrid}>
              <View style={[styles.costItem, { backgroundColor: '#FFEBEE' }]}>
                <Text variant="bodySmall" style={styles.costLabel}>
                  原材料成本
                </Text>
                <Text variant="titleMedium" style={[styles.costValue, { color: '#D32F2F' }]}>
                  ¥{materialCost.toFixed(2)}
                </Text>
                <Text variant="bodySmall" style={styles.costPercentage}>
                  {materialCostRatio.toFixed(1)}%
                </Text>
              </View>

              <View style={[styles.costItem, { backgroundColor: '#E3F2FD' }]}>
                <Text variant="bodySmall" style={styles.costLabel}>
                  人工成本
                </Text>
                <Text variant="titleMedium" style={[styles.costValue, { color: '#1976D2' }]}>
                  ¥{laborCost.toFixed(2)}
                </Text>
                <Text variant="bodySmall" style={styles.costPercentage}>
                  {laborCostRatio.toFixed(1)}%
                </Text>
              </View>

              <View style={[styles.costItem, { backgroundColor: '#F3E5F5' }]}>
                <Text variant="bodySmall" style={styles.costLabel}>
                  设备成本
                </Text>
                <Text variant="titleMedium" style={[styles.costValue, { color: '#7B1FA2' }]}>
                  ¥{equipmentCost.toFixed(2)}
                </Text>
                <Text variant="bodySmall" style={styles.costPercentage}>
                  {equipmentCostRatio.toFixed(1)}%
                </Text>
              </View>

              <View style={[styles.costItem, { backgroundColor: '#E8F5E9' }]}>
                <Text variant="bodySmall" style={styles.costLabel}>
                  总成本
                </Text>
                <Text variant="titleLarge" style={[styles.costValue, { color: '#388E3C' }]}>
                  ¥{totalCost.toFixed(2)}
                </Text>
                <Text variant="bodySmall" style={styles.costPercentage}>
                  100%
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 成本明细 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title="成本明细"
            subtitle={`单位成本: ¥${unitCost.toFixed(2)}`}
          />
          <Card.Content>
            <View style={styles.detailRow}>
              <Text variant="bodyMedium">人工成本：</Text>
              <Text variant="titleMedium" style={[styles.detailValue, { color: '#1976D2' }]}>
                ¥{laborCost.toFixed(2)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="bodyMedium">设备成本：</Text>
              <Text variant="titleMedium" style={[styles.detailValue, { color: '#7B1FA2' }]}>
                ¥{equipmentCost.toFixed(2)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="bodyMedium">其他成本：</Text>
              <Text variant="titleMedium" style={[styles.detailValue, { color: '#616161' }]}>
                ¥{otherCost.toFixed(2)}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* AI智能分析区域 */}
        <Card style={styles.aiCard} mode="elevated">
          <Card.Content>
            <View style={styles.aiHeader}>
              <View style={styles.aiTitleRow}>
                <Text variant="titleMedium" style={styles.aiTitle}>
                  AI智能分析
                </Text>
                {quota && (
                  <View style={styles.quotaBadge}>
                    <Text variant="bodySmall" style={styles.quotaText}>
                      本周剩余: {quota.remaining}/{quota.limit}次
                    </Text>
                    {quota.resetDate && (
                      <Text variant="labelSmall" style={styles.resetText}>
                        {getResetText(quota.resetDate)}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>

            {!showAiSection ? (
              // 初始状态 - 显示大按钮
              <View style={styles.aiInitial}>
                <Text variant="bodyMedium" style={styles.aiDescription}>
                  点击获取AI智能优化建议，分析成本结构和改进方向
                </Text>
                <Button
                  mode="contained"
                  icon="sparkles"
                  onPress={() => handleAiAnalysis()}
                  loading={aiLoading}
                  disabled={quota?.remaining === 0}
                  style={styles.aiButton}
                  contentStyle={styles.aiButtonContent}
                >
                  {quota?.remaining === 0 ? '本周次数已用完' : '获取AI优化建议'}
                </Button>
                {quota && quota.remaining === 0 && (
                  <Text variant="bodySmall" style={styles.limitHint}>
                    下周一自动重置配额
                  </Text>
                )}
              </View>
            ) : (
              // AI分析结果展示
              <View style={styles.aiResultSection}>
                {aiLoading ? (
                  <View style={styles.aiLoadingContainer}>
                    <ActivityIndicator size="large" />
                    <Text variant="bodyMedium" style={styles.aiLoadingText}>
                      AI正在分析成本数据，请稍候...
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.aiResultCard}>
                      <Text variant="titleSmall" style={styles.aiResultTitle}>
                        分析结果
                      </Text>
                      <Divider style={styles.aiDivider} />
                      <Text variant="bodyMedium" style={styles.aiResultText}>
                        {aiAnalysis}
                      </Text>
                    </View>

                    <View style={styles.aiActions}>
                      <Button
                        mode="contained"
                        icon="file-document-outline"
                        onPress={() => navigation.navigate('AIAnalysis', { batchId: batchId || 'current' })}
                        compact
                      >
                        查看详细分析
                      </Button>
                      <Button
                        mode="outlined"
                        icon="refresh"
                        onPress={() => handleAiAnalysis()}
                        compact
                        disabled={quota?.remaining === 0}
                      >
                        重新分析
                      </Button>
                      <Button mode="outlined" icon="download" compact>
                        导出报告
                      </Button>
                    </View>

                    {/* 快速提问 */}
                    <View style={styles.quickQuestions}>
                      <Text variant="bodySmall" style={styles.quickQuestionsTitle}>
                        快速提问:
                      </Text>
                      {quickQuestions.map((q, index) => (
                        <Button
                          key={index}
                          mode="text"
                          icon="comment-question-outline"
                          onPress={() => handleAiAnalysis(q)}
                          disabled={aiLoading || quota?.remaining === 0}
                          style={styles.quickQuestionButton}
                          contentStyle={styles.quickQuestionContent}
                        >
                          {q}
                        </Button>
                      ))}
                    </View>

                    {/* 自定义问题输入 */}
                    <View style={styles.customQuestionSection}>
                      {!showQuestionInput ? (
                        <Button
                          mode="text"
                          icon="pencil"
                          onPress={() => setShowQuestionInput(true)}
                          disabled={quota?.remaining === 0}
                        >
                          输入自定义问题
                        </Button>
                      ) : (
                        <View style={styles.questionInputContainer}>
                          <TextInput
                            mode="outlined"
                            label="输入您的问题"
                            placeholder="例如：如何提高设备利用率？"
                            value={customQuestion}
                            onChangeText={setCustomQuestion}
                            multiline
                            numberOfLines={2}
                            style={styles.questionInput}
                          />
                          <View style={styles.questionActions}>
                            <Button
                              mode="contained"
                              icon="send"
                              onPress={handleCustomQuestion}
                              loading={aiLoading}
                              compact
                            >
                              发送
                            </Button>
                            <Button
                              mode="text"
                              onPress={() => {
                                setShowQuestionInput(false);
                                setCustomQuestion('');
                              }}
                              compact
                            >
                              取消
                            </Button>
                          </View>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* 批次产量信息（如果有） */}
        {batch.actualQuantity && batch.actualQuantity > 0 && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title="产量信息" />
            <Card.Content>
              <View style={styles.detailRow}>
                <Text variant="bodyMedium">实际产量：</Text>
                <Text variant="titleMedium" style={[styles.detailValue, { color: '#388E3C' }]}>
                  {batch.actualQuantity} 件
                </Text>
              </View>
              {batch.goodQuantity !== undefined && (
                <View style={styles.detailRow}>
                  <Text variant="bodyMedium">良品数量：</Text>
                  <Text variant="titleMedium" style={[styles.detailValue, { color: '#388E3C' }]}>
                    {batch.goodQuantity} 件
                  </Text>
                </View>
              )}
              {batch.defectQuantity !== undefined && batch.defectQuantity > 0 && (
                <View style={styles.detailRow}>
                  <Text variant="bodyMedium">次品数量：</Text>
                  <Text variant="titleMedium" style={[styles.detailValue, { color: '#D32F2F' }]}>
                    {batch.defectQuantity} 件
                  </Text>
                </View>
              )}
              {batch.yieldRate !== undefined && (
                <View style={styles.detailRow}>
                  <Text variant="bodyMedium">良品率：</Text>
                  <Text variant="bodyMedium" style={styles.detailValue}>
                    {(batch.yieldRate * 100).toFixed(1)}%
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
  },
  card: {
    marginBottom: 16,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#757575',
    marginBottom: 4,
  },
  batchNumber: {
    fontWeight: '700',
    color: '#1976D2',
  },
  productInfo: {
    color: '#616161',
  },
  costGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  costItem: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  costLabel: {
    color: '#616161',
    marginBottom: 8,
  },
  costValue: {
    fontWeight: '700',
    marginBottom: 4,
  },
  costPercentage: {
    color: '#757575',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailValue: {
    fontWeight: '600',
  },
  // AI相关样式
  aiCard: {
    marginBottom: 16,
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  aiHeader: {
    marginBottom: 16,
  },
  aiTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  aiTitle: {
    fontWeight: '700',
    color: '#1E40AF',
  },
  quotaBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  quotaText: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  resetText: {
    color: '#64748B',
    marginTop: 2,
  },
  aiInitial: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  aiDescription: {
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 22,
  },
  aiButton: {
    width: '100%',
    borderRadius: 12,
  },
  aiButtonContent: {
    paddingVertical: 8,
  },
  limitHint: {
    color: '#EF4444',
    marginTop: 8,
    textAlign: 'center',
  },
  aiResultSection: {
    marginTop: 8,
  },
  aiLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  aiLoadingText: {
    marginTop: 16,
    color: '#64748B',
  },
  aiResultCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  aiResultTitle: {
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
  },
  aiDivider: {
    marginVertical: 12,
  },
  aiResultText: {
    fontSize: 14,
    lineHeight: 24,
    color: '#1F2937',
  },
  aiActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  quickQuestions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickQuestionsTitle: {
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  quickQuestionButton: {
    marginBottom: 6,
    justifyContent: 'flex-start',
  },
  quickQuestionContent: {
    justifyContent: 'flex-start',
  },
  customQuestionSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  questionInputContainer: {
    gap: 12,
  },
  questionInput: {
    backgroundColor: '#FFFFFF',
  },
  questionActions: {
    flexDirection: 'row',
    gap: 12,
  },
});
