import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Button,
  Checkbox,
  ActivityIndicator,
  Divider,
  Chip,
  IconButton,
  TextInput,
  Switch,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { processingApiClient, BatchResponse } from '../../services/api/processingApiClient';
import { aiApiClient } from '../../services/api/aiApiClient';
import { useAuthStore } from '../../store/authStore';
import { AIQuota } from '../../types/processing';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建BatchComparison专用logger
const batchComparisonLogger = logger.createContextLogger('BatchComparison');

type BatchComparisonScreenProps = ProcessingScreenProps<'BatchComparison'>;

/**
 * 批次对比分析界面
 *
 * 功能:
 * - 选择2-5个批次进行对比分析
 * - 显示批次基础信息和关键指标
 * - 调用AI进行多维度对比分析
 * - 支持自定义对比维度(成本/效率/质量/综合)
 * - 支持自定义追问
 *
 * @version 1.0.0
 * @since 2025-11-05
 */
export default function BatchComparisonScreen() {
  const navigation = useNavigation<BatchComparisonScreenProps['navigation']>();
  const { user } = useAuthStore();

  // 状态管理
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dimension, setDimension] = useState<'cost' | 'efficiency' | 'quality' | 'comprehensive'>('comprehensive');

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

  // 快速问题
  const QUICK_QUESTIONS = [
    '哪个批次的成本效益最高?',
    '如何优化效率较低的批次?',
    '质量差异的主要原因是什么?',
  ];

  // 页面加载时获取数据
  useEffect(() => {
    fetchBatches();
    loadAIQuota();
  }, []);

  /**
   * 获取批次列表
   */
  const fetchBatches = async () => {
    try {
      setLoading(true);

      const result = await processingApiClient.getBatches({ status: 'completed' });

      // 兼容不同的响应格式
      let batchList: BatchResponse[] = [];
      if (result.data?.batches) {
        batchList = result.data.batches;
      } else if (result.batches) {
        batchList = result.batches;
      } else if (result.data) {
        batchList = result.data;
      } else if (Array.isArray(result)) {
        batchList = result;
      }

      batchComparisonLogger.info('已完成批次列表加载成功', {
        batchCount: batchList.length,
        factoryId: user?.factoryUser?.factoryId,
      });
      setBatches(batchList);
    } catch (error) {
      batchComparisonLogger.error('获取批次列表失败', error as Error, {
        factoryId: user?.factoryUser?.factoryId,
      });
      Alert.alert('加载失败', error.response?.data?.message || error.message || '请稍后重试');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载AI配额信息
   */
  const loadAIQuota = async () => {
    try {
      const factoryId = user?.factoryUser?.factoryId;
      if (!factoryId) return;

      const response = await aiApiClient.getQuotaInfo(factoryId);
      if (response && response.data) {
        setAiQuota(response.data);
      }
    } catch (error) {
      batchComparisonLogger.warn('加载AI配额失败', {
        factoryId: user?.factoryUser?.factoryId,
        error: (error as Error).message,
      });
    }
  };

  /**
   * 切换批次选择
   */
  const toggleBatchSelection = (batchId: number) => {
    const newSelection = new Set(selectedBatches);
    if (newSelection.has(batchId)) {
      newSelection.delete(batchId);
    } else {
      if (newSelection.size >= 5) {
        Alert.alert('提示', '最多只能选择5个批次进行对比');
        return;
      }
      newSelection.add(batchId);
    }
    setSelectedBatches(newSelection);
  };

  /**
   * AI对比分析
   */
  const handleAIComparison = async (question?: string) => {
    try {
      if (selectedBatches.size < 2) {
        Alert.alert('提示', '请至少选择2个批次进行对比');
        return;
      }

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

      // 调用AI批次对比分析API
      const response = await aiApiClient.compareBatchCosts({
        batchIds: Array.from(selectedBatches),
        dimension: dimension,
        question: question || undefined,
        enableThinking, // 思考模式开关
      }, factoryId);

      if (response && response.data) {
        setAiAnalysis(response.data.analysis || '');
        setSessionId(response.data.session_id || '');

        // 更新配额信息
        if (response.data.quota) {
          setAiQuota(response.data.quota);
        }

        // 清空自定义问题输入
        setCustomQuestion('');
        setShowQuestionInput(false);

        batchComparisonLogger.info('AI批次对比分析成功', {
          batchCount: selectedBatches.size,
          dimension,
          hasQuestion: !!question,
          sessionId: response.data.session_id,
          factoryId,
        });
      }
    } catch (error) {
      batchComparisonLogger.error('AI批次对比分析失败', error as Error, {
        batchCount: selectedBatches.size,
        dimension,
        factoryId: user?.factoryUser?.factoryId,
      });
      Alert.alert('AI分析失败', error.response?.data?.message || error.message || '请稍后重试');
      setAiAnalysis('');
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * 获取对比维度配置
   */
  const getDimensionChip = (dim: string) => {
    const config = {
      cost: { label: '成本对比', icon: 'currency-cny', color: '#2196F3' },
      efficiency: { label: '效率对比', icon: 'speedometer', color: '#4CAF50' },
      quality: { label: '质量对比', icon: 'quality-high', color: '#FF9800' },
      comprehensive: { label: '综合对比', icon: 'compare', color: '#9C27B0' },
    };

    return config[dim as keyof typeof config] || config.comprehensive;
  };

  /**
   * 渲染批次卡片
   */
  const renderBatchCard = (batch: BatchResponse) => {
    const isSelected = selectedBatches.has(batch.id);

    return (
      <TouchableOpacity
        key={batch.id}
        onPress={() => toggleBatchSelection(batch.id)}
        activeOpacity={0.7}
      >
        <Card
          style={[styles.batchCard, isSelected && styles.selectedCard]}
          mode="elevated"
        >
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                <Checkbox
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => toggleBatchSelection(batch.id)}
                />
                <Text variant="titleMedium" style={styles.batchNumber}>
                  {batch.batchNumber}
                </Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.infoRow}>
                <Text variant="bodySmall" style={styles.label}>产品:</Text>
                <Text variant="bodySmall" style={styles.value}>
                  {batch.productType || '待定'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text variant="bodySmall" style={styles.label}>产量:</Text>
                <Text variant="bodySmall" style={styles.value}>
                  {batch.actualQuantity || 0} kg
                </Text>
              </View>

              {batch.createdAt && (
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.label}>时间:</Text>
                  <Text variant="bodySmall" style={styles.value}>
                    {new Date(batch.createdAt).toLocaleDateString('zh-CN')}
                  </Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 顶部导航栏 */}
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="批次对比分析" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 选择提示 */}
        <Card style={styles.hintCard} mode="outlined">
          <Card.Content>
            <View style={styles.hintRow}>
              <Text variant="bodyMedium" style={styles.hintText}>
                已选择 {selectedBatches.size} 个批次 (最多5个，最少2个)
              </Text>
              {aiQuota && (
                <Chip
                  icon="flash"
                  mode="flat"
                  compact
                  style={styles.quotaChip}
                  textStyle={styles.quotaText}
                >
                  剩余 {aiQuota.remaining} 次
                </Chip>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* 思考模式开关 */}
        <Card style={styles.thinkingCard} mode="outlined">
          <Card.Content>
            <View style={styles.thinkingModeRow}>
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall" style={styles.sectionTitle}>深度思考模式</Text>
                <Text variant="bodySmall" style={styles.thinkingHint}>
                  {enableThinking ? 'AI深度推理，结果更准确' : '普通模式，响应更快'}
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

        {/* 对比维度选择 */}
        <Card style={styles.dimensionCard} mode="outlined">
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>选择对比维度</Text>
            <View style={styles.dimensionButtons}>
              {(['cost', 'efficiency', 'quality', 'comprehensive'] as const).map((dim) => {
                const config = getDimensionChip(dim);
                return (
                  <Chip
                    key={dim}
                    selected={dimension === dim}
                    onPress={() => setDimension(dim)}
                    icon={config.icon}
                    mode={dimension === dim ? 'flat' : 'outlined'}
                    style={[
                      styles.dimensionChip,
                      dimension === dim && { backgroundColor: config.color + '20' },
                    ]}
                    textStyle={dimension === dim ? { color: config.color } : {}}
                  >
                    {config.label}
                  </Chip>
                );
              })}
            </View>
          </Card.Content>
        </Card>

        {/* 批次列表 */}
        <View style={styles.batchListContainer}>
          <Text variant="titleSmall" style={styles.sectionTitle}>选择批次</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <Text variant="bodyMedium" style={styles.loadingText}>加载中...</Text>
            </View>
          ) : batches.length === 0 ? (
            <Card style={styles.emptyCard} mode="outlined">
              <Card.Content>
                <Text variant="bodyMedium" style={styles.emptyText}>暂无已完成的批次</Text>
              </Card.Content>
            </Card>
          ) : (
            batches.map(renderBatchCard)
          )}
        </View>

        {/* AI分析按钮 */}
        {!showAISection && selectedBatches.size >= 2 && (
          <Button
            mode="contained"
            icon="brain"
            onPress={() => handleAIComparison()}
            style={styles.analyzeButton}
            contentStyle={styles.analyzeButtonContent}
          >
            开始AI对比分析
          </Button>
        )}

        {/* AI分析结果 */}
        {showAISection && (
          <Card style={styles.aiCard} mode="elevated">
            <Card.Content>
              <View style={styles.aiHeader}>
                <Text variant="titleMedium" style={styles.aiTitle}>AI对比分析</Text>
                {aiQuota && (
                  <Chip
                    icon="flash"
                    mode="flat"
                    compact
                    style={styles.quotaBadge}
                    textStyle={styles.quotaBadgeText}
                  >
                    {aiQuota.remaining}/{aiQuota.limit}
                  </Chip>
                )}
              </View>

              <Divider style={styles.divider} />

              {aiLoading ? (
                <View style={styles.aiLoadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                  <Text variant="bodyMedium" style={styles.aiLoadingText}>AI正在分析中...</Text>
                </View>
              ) : aiAnalysis ? (
                <>
                  <Text variant="bodyMedium" style={styles.aiAnalysisText}>
                    {aiAnalysis}
                  </Text>

                  {sessionId && (
                    <Text variant="bodySmall" style={styles.sessionId}>
                      会话ID: {sessionId}
                    </Text>
                  )}

                  <Divider style={styles.divider} />

                  {/* 快速问题 */}
                  <Text variant="titleSmall" style={styles.quickQuestionsTitle}>快速追问</Text>
                  <View style={styles.quickQuestions}>
                    {QUICK_QUESTIONS.map((q, index) => (
                      <Chip
                        key={index}
                        icon="help-circle-outline"
                        mode="outlined"
                        onPress={() => handleAIComparison(q)}
                        disabled={aiLoading}
                        style={styles.questionChip}
                      >
                        {q}
                      </Chip>
                    ))}
                  </View>

                  {/* 自定义问题 */}
                  {!showQuestionInput ? (
                    <Button
                      mode="text"
                      icon="message-text-outline"
                      onPress={() => setShowQuestionInput(true)}
                      style={styles.customQuestionButton}
                    >
                      自定义问题
                    </Button>
                  ) : (
                    <View style={styles.customQuestionContainer}>
                      <TextInput
                        label="输入您的问题"
                        value={customQuestion}
                        onChangeText={setCustomQuestion}
                        mode="outlined"
                        multiline
                        numberOfLines={3}
                        style={styles.customQuestionInput}
                      />
                      <View style={styles.customQuestionButtons}>
                        <Button
                          mode="outlined"
                          onPress={() => {
                            setShowQuestionInput(false);
                            setCustomQuestion('');
                          }}
                          style={styles.cancelButton}
                        >
                          取消
                        </Button>
                        <Button
                          mode="contained"
                          onPress={() => handleAIComparison(customQuestion)}
                          disabled={!customQuestion.trim() || aiLoading}
                          style={styles.submitButton}
                        >
                          提交
                        </Button>
                      </View>
                    </View>
                  )}
                </>
              ) : null}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  hintCard: {
    marginBottom: 16,
    backgroundColor: '#E3F2FD',
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hintText: {
    color: '#1976D2',
    fontWeight: '600',
  },
  quotaChip: {
    backgroundColor: '#2196F3',
  },
  quotaText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  dimensionCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  dimensionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dimensionChip: {
    marginRight: 0,
  },
  batchListContainer: {
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#757575',
  },
  emptyCard: {
    padding: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9E9E9E',
  },
  batchCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  cardHeader: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batchNumber: {
    fontWeight: '700',
    color: '#212121',
    flex: 1,
  },
  cardBody: {
    gap: 6,
    paddingLeft: 40,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: '#757575',
    width: 50,
  },
  value: {
    color: '#424242',
    flex: 1,
  },
  analyzeButton: {
    marginVertical: 16,
  },
  analyzeButtonContent: {
    height: 50,
  },
  aiCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiTitle: {
    fontWeight: '700',
    color: '#212121',
  },
  quotaBadge: {
    backgroundColor: '#E3F2FD',
  },
  quotaBadgeText: {
    color: '#2196F3',
    fontSize: 12,
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#E0E0E0',
  },
  aiLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  aiLoadingText: {
    marginTop: 12,
    color: '#2196F3',
  },
  aiAnalysisText: {
    color: '#424242',
    lineHeight: 24,
  },
  sessionId: {
    marginTop: 12,
    color: '#9E9E9E',
    fontSize: 11,
  },
  quickQuestionsTitle: {
    fontWeight: '600',
    color: '#424242',
    marginBottom: 12,
  },
  quickQuestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  questionChip: {
    marginRight: 0,
  },
  customQuestionButton: {
    marginTop: 8,
  },
  customQuestionContainer: {
    marginTop: 12,
  },
  customQuestionInput: {
    marginBottom: 12,
  },
  customQuestionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  thinkingCard: {
    marginBottom: 16,
    backgroundColor: '#F3E5F5',
  },
  thinkingModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thinkingHint: {
    color: '#757575',
    marginTop: 4,
  },
});
