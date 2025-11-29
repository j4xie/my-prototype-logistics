import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Appbar, Card, Button, ActivityIndicator, Chip, SegmentedButtons, IconButton, TextInput, Divider, Switch } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { DatePickerModal } from 'react-native-paper-dates';
import { useAuthStore } from '../../store/authStore';
import { processingApiClient } from '../../services/api/processingApiClient';
import { aiApiClient } from '../../services/api/aiApiClient';
import { AIQuota } from '../../types/processing';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建TimeRangeCostAnalysis专用logger
const timeRangeLogger = logger.createContextLogger('TimeRangeCostAnalysis');

type TimeRangeCostAnalysisNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'ProcessingDashboard'
>;

// 快速问题常量
const QUICK_QUESTIONS = [
  '如何降低这段时间的成本?',
  '哪个时间段效率最高?',
  '成本波动的原因是什么?',
];

/**
 * 时间范围成本分析页面
 *
 * 功能：
 * - 选择时间范围（日期区间）
 * - 查看时间段内的成本汇总
 * - 显示批次列表和成本趋势
 * - AI智能分析时间段数据
 */
export default function TimeRangeCostAnalysisScreen() {
  const navigation = useNavigation<TimeRangeCostAnalysisNavigationProp>();
  const { user } = useAuthStore();

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [quickRange, setQuickRange] = useState<string>('week');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: new Date(),
    endDate: new Date(),
  });

  // 成本数据状态
  const [costSummary, setCostSummary] = useState<any>(null);

  // AI分析状态
  const [showAISection, setShowAISection] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuota, setAiQuota] = useState<AIQuota | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  // 自定义问题状态
  const [customQuestion, setCustomQuestion] = useState('');
  const [showQuestionInput, setShowQuestionInput] = useState(false);

  // 思考模式状态（默认开启）
  const [enableThinking, setEnableThinking] = useState(true);

  // 快捷时间范围选项
  const quickRangeOptions = [
    { value: 'today', label: '今天' },
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' },
    { value: 'custom', label: '自定义' },
  ];

  // 处理快捷范围选择
  useEffect(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (quickRange) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'custom':
        // 自定义范围不自动设置，等待用户选择
        return;
    }

    setDateRange({ startDate: start, endDate: end });
    loadCostData(start, end);
    loadAIQuota(); // 加载配额信息
  }, [quickRange]);

  // 加载AI配额信息
  const loadAIQuota = async () => {
    try {
      const factoryId = user?.factoryUser?.factoryId;
      if (!factoryId) return;

      const response = await aiApiClient.getQuotaInfo(factoryId);
      if (response.success && response.data) {
        setAiQuota(response.data);
      }
    } catch (error) {
      timeRangeLogger.error('加载AI配额失败', error, { factoryId: user?.factoryUser?.factoryId });
    }
  };

  // 加载成本数据
  const loadCostData = async (start: Date, end: Date) => {
    try {
      setLoading(true);
      timeRangeLogger.debug('加载时间范围成本数据', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        factoryId: user?.factoryUser?.factoryId,
      });

      // 调用后端API
      const response = await processingApiClient.getTimeRangeCostAnalysis({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        factoryId: user?.factoryUser?.factoryId,
      });

      timeRangeLogger.info('成本数据加载成功', {
        totalCost: response.data?.totalCost,
        materialCost: response.data?.materialCost,
      });

      // 转换后端数据格式为前端期望的格式
      if (response.data) {
        const backendData = response.data;
        const transformedData = {
          totalCost: Number(backendData.totalCost || 0),
          totalBatches: 0, // 后端未提供批次数量
          avgCostPerBatch: 0, // 后端未提供平均成本
          costBreakdown: {
            rawMaterials: Number(backendData.materialCost || 0),
            labor: Number(backendData.laborCost || 0),
            equipment: Number(backendData.equipmentCost || 0),
            overhead: Number(backendData.otherCost || 0),
          },
          batches: [], // 后端未提供批次列表
        };
        setCostSummary(transformedData);
      } else {
        // ✅ GOOD: 不返回假数据，设置为null让UI显示空状态
        setCostSummary(null);
      }
    } catch (error) {
      timeRangeLogger.error('加载成本数据失败', error, {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      // ✅ GOOD: 不返回假数据，显示错误提示
      handleError(error, {
        title: '加载失败',
        customMessage: '无法加载成本数据，请稍后重试',
      });
      setCostSummary(null); // 不显示假数据
    } finally {
      setLoading(false);
    }
  };

  // AI分析处理
  const handleAIAnalysis = async (question?: string) => {
    try {
      const factoryId = user?.factoryUser?.factoryId;
      const userId = user?.id;

      if (!factoryId || !userId) {
        Alert.alert('错误', '用户信息不完整');
        return;
      }

      // 检查配额
      if (aiQuota && aiQuota.remaining <= 0) {
        Alert.alert('配额不足', '本周AI分析次数已用完，请等待下周重置');
        return;
      }

      setAiLoading(true);
      setShowAISection(true);

      timeRangeLogger.debug('开始AI时间范围分析', {
        factoryId,
        startDate: dateRange.startDate.toISOString().split('T')[0],
        endDate: dateRange.endDate.toISOString().split('T')[0],
        hasQuestion: !!question,
      });

      // 调用AI时间范围分析API
      const response = await aiApiClient.analyzeTimeRangeCost({
        startDate: dateRange.startDate.toISOString().split('T')[0],
        endDate: dateRange.endDate.toISOString().split('T')[0],
        dimension: 'overall', // 可选: daily, weekly, overall
        question: question || undefined,
        enableThinking, // 思考模式开关
      }, factoryId);

      timeRangeLogger.info('AI分析完成', {
        hasAnalysis: !!response.data?.analysis,
        sessionId: response.data?.session_id,
        quotaRemaining: response.data?.quota?.remaining,
      });

      if (response.success && response.data) {
        setAiAnalysis(response.data.analysis || '');
        setSessionId(response.data.session_id || '');

        // 更新配额信息
        if (response.data.quota) {
          setAiQuota(response.data.quota);
        }

        // 清空自定义问题输入
        setCustomQuestion('');
        setShowQuestionInput(false);
      } else {
        throw new Error(response.data?.errorMessage || 'AI分析失败');
      }
    } catch (error) {
      timeRangeLogger.error('AI分析失败', error, {
        factoryId: user?.factoryUser?.factoryId,
        hasQuestion: !!question,
      });
      Alert.alert(
        'AI分析失败',
        error.response?.data?.message || error.message || '请稍后重试'
      );
      setAiAnalysis('');
    } finally {
      setAiLoading(false);
    }
  };

  // 处理日期选择确认
  const onDateRangeConfirm = ({ startDate, endDate }: any) => {
    setShowDatePicker(false);
    if (startDate && endDate) {
      setDateRange({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
      loadCostData(new Date(startDate), new Date(endDate));
    }
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 格式化金额
  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  };

  // 配额重置文本
  const getResetText = () => {
    if (!aiQuota?.resetDate) return '';

    const reset = new Date(aiQuota.resetDate);
    const now = new Date();
    const days = Math.ceil((reset.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (days === 0) return '明日重置';
    if (days === 1) return '1天后重置';
    return `${days}天后重置`;
  };

  const isQuotaExceeded = aiQuota && aiQuota.remaining <= 0;

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="时间范围成本分析" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* 时间范围选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="选择时间范围" />
          <Card.Content>
            <SegmentedButtons
              value={quickRange}
              onValueChange={setQuickRange}
              buttons={quickRangeOptions}
              style={styles.segmentedButtons}
            />

            {quickRange === 'custom' && (
              <Button
                mode="outlined"
                icon="calendar"
                onPress={() => setShowDatePicker(true)}
                style={styles.customDateButton}
              >
                选择日期范围
              </Button>
            )}

            <View style={styles.dateRangeDisplay}>
              <Chip icon="calendar-start" style={styles.dateChip}>
                {formatDate(dateRange.startDate)}
              </Chip>
              <Text variant="bodyMedium" style={styles.dateRangeSeparator}>
                至
              </Text>
              <Chip icon="calendar-end" style={styles.dateChip}>
                {formatDate(dateRange.endDate)}
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* 加载状态 */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text variant="bodyMedium" style={styles.loadingText}>
              加载成本数据中...
            </Text>
          </View>
        )}

        {/* 成本汇总 */}
        {!loading && costSummary && (
          <>
            <Card style={styles.card} mode="elevated">
              <Card.Title title="成本汇总" />
              <Card.Content>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text variant="headlineMedium" style={styles.summaryValue}>
                      {formatCurrency(costSummary.totalCost)}
                    </Text>
                    <Text variant="bodySmall" style={styles.summaryLabel}>
                      总成本
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text variant="headlineMedium" style={styles.summaryValue}>
                      {costSummary.totalBatches}
                    </Text>
                    <Text variant="bodySmall" style={styles.summaryLabel}>
                      批次数量
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text variant="headlineMedium" style={styles.summaryValue}>
                      {formatCurrency(costSummary.avgCostPerBatch)}
                    </Text>
                    <Text variant="bodySmall" style={styles.summaryLabel}>
                      平均单批成本
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* 成本明细 */}
            <Card style={styles.card} mode="elevated">
              <Card.Title title="成本明细" />
              <Card.Content>
                <View style={styles.breakdownItem}>
                  <Text variant="bodyLarge">原材料成本</Text>
                  <Text variant="bodyLarge" style={styles.breakdownValue}>
                    {formatCurrency(costSummary.costBreakdown.rawMaterials)}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text variant="bodyLarge">人工成本</Text>
                  <Text variant="bodyLarge" style={styles.breakdownValue}>
                    {formatCurrency(costSummary.costBreakdown.labor)}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text variant="bodyLarge">设备成本</Text>
                  <Text variant="bodyLarge" style={styles.breakdownValue}>
                    {formatCurrency(costSummary.costBreakdown.equipment)}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text variant="bodyLarge">管理费用</Text>
                  <Text variant="bodyLarge" style={styles.breakdownValue}>
                    {formatCurrency(costSummary.costBreakdown.overhead)}
                  </Text>
                </View>
              </Card.Content>
            </Card>

            {/* AI智能分析区域 */}
            <Card style={styles.aiCard} mode="elevated">
              <Card.Content>
                {/* AI标题和配额 */}
                <View style={styles.aiHeader}>
                  <View style={styles.aiTitleRow}>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleLarge" style={styles.aiTitle}>
                        🤖 AI智能分析
                      </Text>
                      <Text variant="bodySmall" style={{ color: '#64748B', marginTop: 4 }}>
                        基于DeepSeek技术的时间范围成本分析
                      </Text>
                    </View>

                    {aiQuota && (
                      <View style={styles.quotaBadge}>
                        <Text variant="bodySmall" style={styles.quotaText}>
                          {aiQuota.remaining}/{aiQuota.total}次
                        </Text>
                        <Text variant="bodySmall" style={styles.resetText}>
                          {getResetText()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* 思考模式开关 */}
                <View style={styles.thinkingModeRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">深度思考模式</Text>
                    <Text variant="bodySmall" style={{ color: '#64748B' }}>
                      {enableThinking ? 'AI深度推理，结果更准确' : '普通模式，响应更快'}
                    </Text>
                  </View>
                  <Switch
                    value={enableThinking}
                    onValueChange={setEnableThinking}
                    color="#9C27B0"
                  />
                </View>

                {/* 初始状态 */}
                {!showAISection && (
                  <View style={styles.aiInitial}>
                    <Text variant="bodyMedium" style={styles.aiDescription}>
                      点击下方按钮，AI将分析此时间段的成本数据，为您提供专业的优化建议
                    </Text>
                    <Button
                      mode="contained"
                      onPress={() => handleAIAnalysis()}
                      loading={aiLoading}
                      disabled={aiLoading || isQuotaExceeded}
                      style={styles.aiButton}
                      icon="sparkles"
                    >
                      {isQuotaExceeded ? '本周次数已用完' : '获取AI分析报告'}
                    </Button>
                    {isQuotaExceeded && (
                      <Text variant="bodySmall" style={styles.limitHint}>
                        本周AI分析次数已用完，请等待下周重置
                      </Text>
                    )}
                  </View>
                )}

                {/* 分析中 */}
                {showAISection && aiLoading && !aiAnalysis && (
                  <View style={styles.aiLoadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text variant="bodyMedium" style={styles.aiLoadingText}>
                      AI正在分析您的成本数据...
                    </Text>
                  </View>
                )}

                {/* 分析结果 */}
                {showAISection && aiAnalysis && (
                  <View style={styles.aiResultSection}>
                    {/* AI分析结果 */}
                    <View style={styles.aiResultCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text variant="titleMedium" style={styles.aiResultTitle}>
                          💡 AI分析结果
                        </Text>
                        <IconButton
                          icon="close"
                          size={20}
                          onPress={() => {
                            setShowAISection(false);
                            setAiAnalysis('');
                          }}
                        />
                      </View>
                      <Divider style={styles.aiDivider} />
                      <Text style={styles.aiResultText}>{aiAnalysis}</Text>
                      {sessionId && (
                        <Text variant="bodySmall" style={{ color: '#64748B', marginTop: 12 }}>
                          会话ID: {sessionId.substring(0, 8)}...
                        </Text>
                      )}
                    </View>

                    {/* 快速问题 */}
                    {!isQuotaExceeded && (
                      <View style={styles.quickQuestions}>
                        <Text variant="bodyMedium" style={styles.quickQuestionsTitle}>
                          💬 继续提问
                        </Text>
                        {QUICK_QUESTIONS.map((question, index) => (
                          <Button
                            key={index}
                            mode="outlined"
                            onPress={() => handleAIAnalysis(question)}
                            disabled={aiLoading}
                            style={styles.quickQuestionButton}
                            icon="comment-question"
                          >
                            {question}
                          </Button>
                        ))}
                      </View>
                    )}

                    {/* 自定义问题 */}
                    {!isQuotaExceeded && (
                      <View style={styles.customQuestionSection}>
                        {!showQuestionInput ? (
                          <Button
                            mode="text"
                            onPress={() => setShowQuestionInput(true)}
                            icon="plus"
                          >
                            自定义问题
                          </Button>
                        ) : (
                          <View style={styles.questionInputContainer}>
                            <TextInput
                              mode="outlined"
                              label="输入您的问题"
                              value={customQuestion}
                              onChangeText={setCustomQuestion}
                              multiline
                              numberOfLines={3}
                              placeholder="例如：如何优化本月的成本结构？"
                              style={styles.questionInput}
                            />
                            <View style={styles.questionActions}>
                              <Button
                                mode="outlined"
                                onPress={() => {
                                  setShowQuestionInput(false);
                                  setCustomQuestion('');
                                }}
                                disabled={aiLoading}
                                style={{ flex: 1 }}
                              >
                                取消
                              </Button>
                              <Button
                                mode="contained"
                                onPress={() => {
                                  if (customQuestion.trim()) {
                                    handleAIAnalysis(customQuestion.trim());
                                  }
                                }}
                                disabled={aiLoading || !customQuestion.trim()}
                                loading={aiLoading}
                                style={{ flex: 1 }}
                              >
                                提问
                              </Button>
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    {/* 配额提示 */}
                    {aiQuota && aiQuota.remaining <= 3 && aiQuota.remaining > 0 && (
                      <Text variant="bodySmall" style={{ color: '#F59E0B', marginTop: 12, textAlign: 'center' }}>
                        ⚠️ 本周还剩 {aiQuota.remaining} 次分析机会
                      </Text>
                    )}
                  </View>
                )}
              </Card.Content>
            </Card>
          </>
        )}
      </ScrollView>

      {/* 日期选择器 */}
      <DatePickerModal
        locale="zh"
        mode="range"
        visible={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        onConfirm={onDateRangeConfirm}
        label="选择日期范围"
        saveLabel="确认"
        startLabel="开始日期"
        endLabel="结束日期"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  customDateButton: {
    marginTop: 8,
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  dateChip: {
    backgroundColor: '#E3F2FD',
  },
  dateRangeSeparator: {
    marginHorizontal: 8,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  summaryGrid: {
    gap: 16,
  },
  summaryItem: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  summaryValue: {
    fontWeight: '700',
    color: '#2E7D32',
  },
  summaryLabel: {
    color: '#757575',
    marginTop: 4,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  breakdownValue: {
    fontWeight: '600',
    color: '#1976D2',
  },
  // AI样式
  aiCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
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
    color: '#1E293B',
  },
  quotaBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  quotaText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  resetText: {
    color: '#64748B',
    marginTop: 2,
  },
  thinkingModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  aiInitial: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  aiDescription: {
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  aiButton: {
    marginTop: 8,
    width: '100%',
  },
  limitHint: {
    color: '#F59E0B',
    marginTop: 8,
    textAlign: 'center',
  },
  aiLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  aiLoadingText: {
    marginTop: 16,
    color: '#64748B',
  },
  aiResultSection: {
    marginTop: 8,
  },
  aiResultCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  aiResultTitle: {
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  aiDivider: {
    marginVertical: 12,
  },
  aiResultText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
  },
  quickQuestions: {
    marginTop: 16,
  },
  quickQuestionsTitle: {
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  quickQuestionButton: {
    marginBottom: 8,
    borderColor: '#CBD5E1',
  },
  customQuestionSection: {
    marginTop: 16,
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
