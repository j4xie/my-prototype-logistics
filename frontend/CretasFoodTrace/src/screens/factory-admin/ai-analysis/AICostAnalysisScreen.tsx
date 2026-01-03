/**
 * AI成本分析页面
 * 支持时间范围选择和多维度分析
 * 支持流式响应，实时显示AI分析进度
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { FAAIStackParamList } from '../../../types/navigation';
import { aiApiClient, AICostAnalysisResponse, SSECallbacks } from '../../../services/api/aiApiClient';
import { MarkdownRenderer } from '../../../components/common/MarkdownRenderer';

type NavigationProp = NativeStackNavigationProp<FAAIStackParamList, 'AICostAnalysis'>;

type Dimension = 'overall' | 'daily' | 'weekly';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function AICostAnalysisScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('management');
  const scrollViewRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(false);
  const [dimension, setDimension] = useState<Dimension>('overall');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7); // 默认7天
    return { startDate: start, endDate: end };
  });
  const [result, setResult] = useState<AICostAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 流式响应状态
  const [useStreaming, setUseStreaming] = useState(true);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [thinkingContent, setThinkingContent] = useState<string>('');
  const [partialAnswer, setPartialAnswer] = useState<string>('');
  const [showThinking, setShowThinking] = useState(false);

  // 快速日期范围选项
  const quickRanges = [
    { label: t('aiCostAnalysis.last7Days'), days: 7 },
    { label: t('aiCostAnalysis.last30Days'), days: 30 },
    { label: t('aiCostAnalysis.last90Days'), days: 90 },
  ];

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({ startDate: start, endDate: end });
  };

  const formatDate = (date: Date): string => {
    const isoString = date.toISOString();
    return isoString.split('T')[0] ?? isoString.substring(0, 10);
  };

  const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDimensionLabel = (dim: Dimension): string => {
    const labels: Record<Dimension, string> = {
      overall: t('aiCostAnalysis.overallAnalysis'),
      daily: t('aiCostAnalysis.dailyAnalysis'),
      weekly: t('aiCostAnalysis.weeklyAnalysis'),
    };
    return labels[dim];
  };

  const runAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgressMessage('');
      setThinkingContent('');
      setPartialAnswer('');

      if (useStreaming) {
        // 流式响应模式
        const callbacks: SSECallbacks = {
          onStart: () => {
            setProgressMessage(t('aiCostAnalysis.startingAnalysis'));
          },
          onProgress: (message: string) => {
            setProgressMessage(message);
          },
          onThinking: (content: string) => {
            setThinkingContent((prev) => prev + content);
            // 自动滚动到底部
            scrollViewRef.current?.scrollToEnd({ animated: true });
          },
          onAnswer: (content: string) => {
            setPartialAnswer((prev) => prev + content);
            // 自动滚动到底部
            scrollViewRef.current?.scrollToEnd({ animated: true });
          },
          onComplete: (data) => {
            setResult({
              success: true,
              analysis: data.analysis,
              session_id: data.sessionId,
              responseTimeMs: data.responseTimeMs,
            });
            setProgressMessage('');
            setLoading(false);
          },
          onError: (message: string) => {
            setError(message);
            setLoading(false);
          },
        };

        await aiApiClient.analyzeTimeRangeCostStream(
          {
            startDate: formatDate(dateRange.startDate),
            endDate: formatDate(dateRange.endDate),
            dimension,
          },
          callbacks
        );
      } else {
        // 非流式响应模式
        const response = await aiApiClient.analyzeTimeRangeCost({
          startDate: formatDate(dateRange.startDate),
          endDate: formatDate(dateRange.endDate),
          dimension,
        });

        if (response.success) {
          setResult(response);
        } else {
          setError(response.errorMessage || t('aiCostAnalysis.analysisFailed'));
        }
        setLoading(false);
      }
    } catch (err) {
      console.error('成本分析失败:', err);
      setError(t('aiCostAnalysis.networkError'));
      setLoading(false);
    }
  }, [dateRange, dimension, useStreaming]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('aiCostAnalysis.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* 时间范围选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aiCostAnalysis.timeRange')}</Text>
          <View style={styles.dateRangeCard}>
            <View style={styles.dateDisplay}>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>{t('aiCostAnalysis.startDate')}</Text>
                <Text style={styles.dateValue}>{formatDisplayDate(dateRange.startDate)}</Text>
              </View>
              <Icon source="arrow-right" size={20} color="#999" />
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>{t('aiCostAnalysis.endDate')}</Text>
                <Text style={styles.dateValue}>{formatDisplayDate(dateRange.endDate)}</Text>
              </View>
            </View>
            <View style={styles.quickRanges}>
              {quickRanges.map((range) => (
                <TouchableOpacity
                  key={range.days}
                  style={styles.quickRangeBtn}
                  onPress={() => setQuickRange(range.days)}
                >
                  <Text style={styles.quickRangeText}>{range.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 分析维度 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aiCostAnalysis.analysisDimension')}</Text>
          <View style={styles.dimensionGrid}>
            {(['overall', 'daily', 'weekly'] as Dimension[]).map((dim) => (
              <TouchableOpacity
                key={dim}
                style={[
                  styles.dimensionItem,
                  dimension === dim && styles.dimensionItemActive,
                ]}
                onPress={() => setDimension(dim)}
              >
                <Icon
                  source={
                    dim === 'overall' ? 'chart-pie' :
                    dim === 'daily' ? 'calendar-today' : 'calendar-week'
                  }
                  size={24}
                  color={dimension === dim ? '#fff' : '#667eea'}
                />
                <Text
                  style={[
                    styles.dimensionLabel,
                    dimension === dim && styles.dimensionLabelActive,
                  ]}
                >
                  {getDimensionLabel(dim)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 流式响应开关 */}
        <View style={styles.section}>
          <View style={styles.streamingToggle}>
            <View style={styles.streamingToggleLeft}>
              <Icon source="lightning-bolt" size={20} color="#667eea" />
              <Text style={styles.streamingToggleLabel}>{t('aiCostAnalysis.realtimeStreaming')}</Text>
            </View>
            <Switch
              value={useStreaming}
              onValueChange={setUseStreaming}
              trackColor={{ false: '#ccc', true: '#667eea' }}
              thumbColor={useStreaming ? '#fff' : '#f4f3f4'}
            />
          </View>
          <Text style={styles.streamingHint}>
            {useStreaming ? t('aiCostAnalysis.streamingOnHint') : t('aiCostAnalysis.streamingOffHint')}
          </Text>
        </View>

        {/* 开始分析按钮 */}
        <TouchableOpacity
          style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
          onPress={runAnalysis}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.analyzeBtnText}>{t('aiCostAnalysis.analyzing')}</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Icon source="robot" size={20} color="#fff" />
              <Text style={styles.analyzeBtnText}>{t('aiCostAnalysis.startAnalysis')}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 错误提示 */}
        {error && (
          <View style={styles.errorCard}>
            <Icon source="alert-circle" size={20} color="#e53e3e" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 流式进度显示 */}
        {loading && useStreaming && progressMessage && (
          <View style={styles.progressSection}>
            <View style={styles.progressCard}>
              <ActivityIndicator size="small" color="#667eea" />
              <Text style={styles.progressText}>{progressMessage}</Text>
            </View>
          </View>
        )}

        {/* 思考过程显示 */}
        {useStreaming && thinkingContent && (
          <View style={styles.thinkingSection}>
            <TouchableOpacity
              style={styles.thinkingHeader}
              onPress={() => setShowThinking(!showThinking)}
            >
              <View style={styles.thinkingHeaderLeft}>
                <Icon source="brain" size={18} color="#805ad5" />
                <Text style={styles.thinkingTitle}>{t('aiCostAnalysis.aiThinkingProcess')}</Text>
              </View>
              <Icon
                source={showThinking ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#805ad5"
              />
            </TouchableOpacity>
            {showThinking && (
              <View style={styles.thinkingCard}>
                <Text style={styles.thinkingText}>{thinkingContent}</Text>
              </View>
            )}
          </View>
        )}

        {/* 流式答案显示 */}
        {useStreaming && loading && partialAnswer && (
          <View style={styles.streamingSection}>
            <Text style={styles.streamingTitle}>{t('aiCostAnalysis.aiAnswering')}</Text>
            <View style={styles.streamingCard}>
              <MarkdownRenderer content={partialAnswer} />
              <View style={styles.cursorBlink} />
            </View>
          </View>
        )}

        {/* 分析结果 */}
        {result && (
          <View style={styles.resultSection}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>{t('aiCostAnalysis.analysisResult')}</Text>
              {result.quota && typeof result.quota.remainingQuota === 'number' && (
                <Text style={styles.quotaInfo}>
                  {t('aiCostAnalysis.quota', { remaining: result.quota.remainingQuota ?? 0, total: result.quota.weeklyQuota ?? 0 })}
                </Text>
              )}
            </View>
            <View style={styles.resultCard}>
              <MarkdownRenderer content={typeof result.analysis === 'string' ? result.analysis : t('aiCostAnalysis.noResult')} />
            </View>
            {typeof result.responseTimeMs === 'number' && result.responseTimeMs > 0 && (
              <Text style={styles.responseTime}>
                {t('aiCostAnalysis.responseTime', { time: result.responseTimeMs, cached: result.cacheHit === true ? ` (${t('aiCostAnalysis.cached')})` : '' })}
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  dateRangeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateItem: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  quickRanges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickRangeBtn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: '#f0f3ff',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickRangeText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '500',
  },
  dimensionGrid: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  dimensionItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginHorizontal: 6,
  },
  dimensionItemActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  dimensionLabel: {
    marginTop: 8,
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  dimensionLabelActive: {
    color: '#fff',
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: '#667eea',
    borderRadius: 12,
  },
  analyzeBtnDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analyzeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fed7d7',
    borderRadius: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#c53030',
    marginLeft: 8,
  },
  resultSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  quotaInfo: {
    fontSize: 12,
    color: '#667eea',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  responseTime: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  // 流式模式开关样式
  streamingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  streamingToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streamingToggleLabel: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  streamingHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    paddingHorizontal: 4,
  },
  // 进度显示样式
  progressSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f3ff',
    borderRadius: 12,
    padding: 16,
  },
  progressText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
  },
  // 思考过程样式
  thinkingSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#faf5ff',
    borderRadius: 12,
    padding: 12,
  },
  thinkingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thinkingTitle: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#805ad5',
  },
  thinkingCard: {
    marginTop: 8,
    backgroundColor: '#faf5ff',
    borderRadius: 12,
    padding: 12,
    maxHeight: 200,
  },
  thinkingText: {
    fontSize: 13,
    color: '#6b46c1',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  // 流式答案样式
  streamingSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  streamingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 8,
  },
  streamingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#667eea',
    borderStyle: 'dashed',
  },
  cursorBlink: {
    width: 2,
    height: 16,
    backgroundColor: '#667eea',
    marginTop: 8,
  },
});

export default AICostAnalysisScreen;
