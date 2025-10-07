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
import { useNavigation, useRoute } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { processingAPI } from '../../services/api/processingApiClient';
import type { BatchCostAnalysis, AIQuota } from '../../types/processing';

type CostAnalysisDashboardProps = ProcessingScreenProps<'CostAnalysisDashboard'>;

/**
 * 成本分析仪表板 - 完整版（含AI智能分析）
 */
export default function CostAnalysisDashboard() {
  const navigation = useNavigation<CostAnalysisDashboardProps['navigation']>();
  const route = useRoute<CostAnalysisDashboardProps['route']>();
  const { batchId } = route.params || {};

  // 成本数据状态
  const [costData, setCostData] = useState<BatchCostAnalysis | null>(null);
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
      const response = await processingAPI.getBatchCostAnalysis(batchId);
      if (response.success) {
        setCostData(response.data);
      }
    } catch (error: any) {
      console.error('加载成本数据失败:', error);
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
   */
  const handleAiAnalysis = async (question?: string) => {
    if (!batchId) return;

    setAiLoading(true);
    setShowAiSection(true); // 显示AI区域

    try {
      const response = await processingAPI.aiCostAnalysis({
        batchId: batchId.toString(),
        question: question || undefined,
        session_id: aiSessionId || undefined,
      });

      if (response.success) {
        setAiAnalysis(response.data.analysis);
        setAiSessionId(response.data.session_id);
        if (response.data.quota) {
          setQuota(response.data.quota);
        }
      }
    } catch (error: any) {
      console.error('AI分析失败:', error);

      // 处理429错误（超限）
      if (error.response?.status === 429) {
        Alert.alert('使用上限', error.response?.data?.message || '本周AI分析次数已达上限，请下周一再试');
      } else if (error.response?.status === 403) {
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

  const { batch, laborStats, equipmentStats, costBreakdown, profitAnalysis } = costData;

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
              <Chip mode="flat">{batch.status}</Chip>
            </View>
            <Text variant="bodyMedium" style={styles.productInfo}>
              {batch.productType} • {batch.rawMaterialCategory}
            </Text>
          </Card.Content>
        </Card>

        {/* 成本概览 - 4格网格 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="💰 成本概览" />
          <Card.Content>
            <View style={styles.costGrid}>
              <View style={[styles.costItem, { backgroundColor: '#FFEBEE' }]}>
                <Text variant="bodySmall" style={styles.costLabel}>
                  原材料成本
                </Text>
                <Text variant="titleMedium" style={[styles.costValue, { color: '#D32F2F' }]}>
                  ¥{costBreakdown.rawMaterialCost.toFixed(2)}
                </Text>
                <Text variant="bodySmall" style={styles.costPercentage}>
                  {costBreakdown.rawMaterialPercentage}
                </Text>
              </View>

              <View style={[styles.costItem, { backgroundColor: '#E3F2FD' }]}>
                <Text variant="bodySmall" style={styles.costLabel}>
                  人工成本
                </Text>
                <Text variant="titleMedium" style={[styles.costValue, { color: '#1976D2' }]}>
                  ¥{costBreakdown.laborCost.toFixed(2)}
                </Text>
                <Text variant="bodySmall" style={styles.costPercentage}>
                  {costBreakdown.laborPercentage}
                </Text>
              </View>

              <View style={[styles.costItem, { backgroundColor: '#F3E5F5' }]}>
                <Text variant="bodySmall" style={styles.costLabel}>
                  设备成本
                </Text>
                <Text variant="titleMedium" style={[styles.costValue, { color: '#7B1FA2' }]}>
                  ¥{costBreakdown.equipmentCost.toFixed(2)}
                </Text>
                <Text variant="bodySmall" style={styles.costPercentage}>
                  {costBreakdown.equipmentPercentage}
                </Text>
              </View>

              <View style={[styles.costItem, { backgroundColor: '#E8F5E9' }]}>
                <Text variant="bodySmall" style={styles.costLabel}>
                  总成本
                </Text>
                <Text variant="titleLarge" style={[styles.costValue, { color: '#388E3C' }]}>
                  ¥{costBreakdown.totalCost.toFixed(2)}
                </Text>
                <Text variant="bodySmall" style={styles.costPercentage}>
                  100%
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 人工详情 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title="👥 人工详情"
            subtitle={`${laborStats.totalSessions}人 • 总工时${Math.floor(laborStats.totalMinutes / 60)}h`}
          />
          <Card.Content>
            <View style={styles.detailRow}>
              <Text variant="bodyMedium">已完成工时：</Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {laborStats.completedSessions}人次
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="bodyMedium">总人工成本：</Text>
              <Text variant="titleMedium" style={[styles.detailValue, { color: '#1976D2' }]}>
                ¥{laborStats.totalLaborCost.toFixed(2)}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* 设备详情 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title="⚙️ 设备详情"
            subtitle={`${equipmentStats.totalUsages}台 • 总时长${Math.floor(equipmentStats.totalDuration / 60)}h`}
          />
          <Card.Content>
            <View style={styles.detailRow}>
              <Text variant="bodyMedium">已完成使用：</Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {equipmentStats.completedUsages}次
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="bodyMedium">总设备成本：</Text>
              <Text variant="titleMedium" style={[styles.detailValue, { color: '#7B1FA2' }]}>
                ¥{equipmentStats.totalEquipmentCost.toFixed(2)}
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
                  🤖 AI智能分析
                </Text>
                {quota && (
                  <View style={styles.quotaBadge}>
                    <Text variant="bodySmall" style={styles.quotaText}>
                      本周剩余: {quota.remaining}/{quota.limit}次
                    </Text>
                    {quota.resetDate && (
                      <Text variant="caption" style={styles.resetText}>
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
                        📋 分析结果
                      </Text>
                      <Divider style={styles.aiDivider} />
                      <Text variant="bodyMedium" style={styles.aiResultText}>
                        {aiAnalysis}
                      </Text>
                    </View>

                    <View style={styles.aiActions}>
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
                        💬 快速提问:
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

        {/* 利润分析（如果有） */}
        {profitAnalysis.expectedRevenue && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title="📈 利润分析" />
            <Card.Content>
              <View style={styles.detailRow}>
                <Text variant="bodyMedium">预期收入：</Text>
                <Text variant="titleMedium" style={[styles.detailValue, { color: '#388E3C' }]}>
                  ¥{profitAnalysis.expectedRevenue.toFixed(2)}
                </Text>
              </View>
              {profitAnalysis.profitMargin !== undefined && (
                <View style={styles.detailRow}>
                  <Text variant="bodyMedium">利润：</Text>
                  <Text
                    variant="titleMedium"
                    style={[
                      styles.detailValue,
                      { color: profitAnalysis.profitMargin >= 0 ? '#388E3C' : '#D32F2F' },
                    ]}
                  >
                    ¥{profitAnalysis.profitMargin.toFixed(2)}
                    {profitAnalysis.profitRate !== undefined &&
                      ` (${profitAnalysis.profitRate.toFixed(1)}%)`}
                  </Text>
                </View>
              )}
              {profitAnalysis.breakEvenPrice && (
                <View style={styles.detailRow}>
                  <Text variant="bodyMedium">盈亏平衡价：</Text>
                  <Text variant="bodyMedium" style={styles.detailValue}>
                    ¥{profitAnalysis.breakEvenPrice}/kg
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
