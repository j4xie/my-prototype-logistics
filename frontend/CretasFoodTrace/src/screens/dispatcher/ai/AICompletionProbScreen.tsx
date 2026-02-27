/**
 * AI完成概率分析屏幕
 *
 * 功能:
 * - Monte Carlo模拟完成概率展示
 * - 各批次概率列表
 * - 影响因素分析
 * - AI洞察与建议
 * - 风险提示
 * - 置信区间说明
 *
 * @version 2.0.0
 * @since 2025-12-28
 * @updated 2025-12-30 - 移除 Mock 数据，连接真实 API
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { schedulingApiClient, CompletionProbabilityResponse } from '../../../services/api/schedulingApiClient';

// 主题颜色
const DISPATCHER_THEME = {
  primary: '#722ed1',
  secondary: '#a18cd1',
  accent: '#fbc2eb',
  success: '#52c41a',
  warning: '#fa8c16',
  danger: '#ff4d4f',
  info: '#1890ff',
  background: '#f5f5f5',
  cardBackground: '#ffffff',
};

// 批次概率类型
interface BatchProbability {
  id: string;
  name: string;
  deadline: string;
  remainingHours: string;
  probability: number;
  level: 'high' | 'medium' | 'low';
  isRisk: boolean;
}

// 影响因素类型
interface Factor {
  id: string;
  name: string;
  value: string;
  impact: string;
  percentage: number;
  type: 'positive' | 'neutral' | 'negative';
}

// 置信区间类型
interface ConfidenceInfo {
  label: string;
  value: string;
}

// API 数据转换为本地类型
function convertToBatchProbability(resp: CompletionProbabilityResponse): BatchProbability {
  const probability = Math.round(resp.probability * 100);
  let level: 'high' | 'medium' | 'low' = 'medium';
  if (probability >= 80) level = 'high';
  else if (probability < 60) level = 'low';

  return {
    id: resp.scheduleId,
    name: resp.scheduleName ?? `排程 ${resp.scheduleId.substring(0, 8)}`,
    deadline: '-',
    remainingHours: '-',
    probability,
    level,
    isRisk: resp.riskLevel === 'high' || probability < 60,
  };
}

// 从 API factors 转换为本地格式
function convertToFactors(resp: CompletionProbabilityResponse): Factor[] {
  const factors: Factor[] = [];
  const f = resp.factors;

  if (f.workerEfficiency !== undefined) {
    const pct = Math.round(f.workerEfficiency * 100);
    factors.push({
      id: '1',
      name: '人员效率',
      value: pct >= 80 ? '良好' : pct >= 60 ? '正常' : '不足',
      impact: pct >= 70 ? `+${pct - 70}%` : `${pct - 70}%`,
      percentage: pct,
      type: pct >= 80 ? 'positive' : pct >= 60 ? 'neutral' : 'negative',
    });
  }

  if (f.equipmentStatus !== undefined) {
    const pct = Math.round(f.equipmentStatus * 100);
    factors.push({
      id: '2',
      name: '设备可用率',
      value: pct >= 90 ? '优秀' : pct >= 70 ? '正常' : '偏低',
      impact: pct >= 80 ? `+${pct - 80}%` : `${pct - 80}%`,
      percentage: pct,
      type: pct >= 90 ? 'positive' : pct >= 70 ? 'neutral' : 'negative',
    });
  }

  if (f.materialAvailability !== undefined) {
    const pct = Math.round(f.materialAvailability * 100);
    factors.push({
      id: '3',
      name: '原料匹配度',
      value: pct >= 95 ? '优秀' : pct >= 80 ? '良好' : '不足',
      impact: pct >= 85 ? `+${pct - 85}%` : `${pct - 85}%`,
      percentage: pct,
      type: pct >= 95 ? 'positive' : pct >= 80 ? 'neutral' : 'negative',
    });
  }

  if (f.timeBuffer !== undefined) {
    const pct = Math.round(f.timeBuffer * 100);
    factors.push({
      id: '4',
      name: '时间缓冲',
      value: pct >= 30 ? '充足' : pct >= 15 ? '适中' : '紧张',
      impact: pct >= 20 ? `+${pct - 20}%` : `${pct - 20}%`,
      percentage: Math.min(pct, 100),
      type: pct >= 30 ? 'positive' : pct >= 15 ? 'neutral' : 'negative',
    });
  }

  return factors;
}

export default function AICompletionProbScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 数据状态
  const [overallProbability, setOverallProbability] = useState<number>(0);
  const [probStats, setProbStats] = useState({ high: 0, medium: 0, low: 0 });
  const [batchProbabilities, setBatchProbabilities] = useState<BatchProbability[]>([]);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [confidenceInfo, setConfidenceInfo] = useState<ConfidenceInfo[]>([
    { label: '模拟次数', value: '10,000 次' },
    { label: '置信区间', value: '95%' },
  ]);

  // 获取今天的日期
  const getToday = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const today = getToday();

      // 1. 获取今天的调度计划
      const plansResponse = await schedulingApiClient.getPlans({
        startDate: today,
        endDate: today,
        status: 'confirmed,in_progress',
        page: 1,
        size: 50,
      });

      if (!plansResponse.success || !plansResponse.data) {
        throw new Error(plansResponse.message ?? '获取调度计划失败');
      }

      const plans = plansResponse.data.content ?? [];

      if (plans.length === 0) {
        // 没有今日计划
        setOverallProbability(0);
        setBatchProbabilities([]);
        setFactors([]);
        setAiInsights(['暂无今日排程计划，无法进行概率分析']);
        setLoading(false);
        return;
      }

      // 2. 获取所有计划的批次概率
      const allProbabilities: CompletionProbabilityResponse[] = [];

      for (const plan of plans) {
        try {
          const probResponse = await schedulingApiClient.calculateBatchProbabilities(plan.id);
          if (probResponse.success && probResponse.data) {
            allProbabilities.push(...probResponse.data);
          }
        } catch (e) {
          console.warn(`获取计划 ${plan.id} 的概率失败:`, e);
        }
      }

      if (allProbabilities.length === 0) {
        setOverallProbability(0);
        setBatchProbabilities([]);
        setFactors([]);
        setAiInsights(['暂无排程数据，无法进行概率分析']);
        setLoading(false);
        return;
      }

      // 3. 转换数据
      const batches = allProbabilities.map(convertToBatchProbability);
      setBatchProbabilities(batches);

      // 4. 计算整体概率 (加权平均)
      const totalProb = batches.reduce((sum, b) => sum + b.probability, 0);
      const avgProb = Math.round(totalProb / batches.length);
      setOverallProbability(avgProb);

      // 5. 计算概率分布统计
      const stats = { high: 0, medium: 0, low: 0 };
      batches.forEach((b) => {
        if (b.level === 'high') stats.high++;
        else if (b.level === 'medium') stats.medium++;
        else stats.low++;
      });
      setProbStats(stats);

      // 6. 转换影响因素 (取第一个有 factors 的)
      const firstWithFactors = allProbabilities.find((p) => p.factors);
      if (firstWithFactors) {
        setFactors(convertToFactors(firstWithFactors));
      }

      // 7. AI 洞察
      const insights: string[] = [];
      const riskBatches = batches.filter((b) => b.isRisk);
      if (riskBatches.length > 0) {
        insights.push(`⚠️ ${riskBatches.length} 个批次存在风险，建议优先关注`);
      }

      const firstWithSuggestions = allProbabilities.find((p) => p.suggestions?.length);
      if (firstWithSuggestions?.suggestions) {
        insights.push(...firstWithSuggestions.suggestions);
      }

      if (firstWithSuggestions?.llmAnalysis) {
        insights.push(`💡 ${firstWithSuggestions.llmAnalysis}`);
      }

      if (insights.length === 0) {
        insights.push('当前排程运行正常，预计可按时完成');
      }

      setAiInsights(insights);

      // 8. 置信区间信息
      const firstWithCI = allProbabilities.find((p) => p.confidenceInterval);
      if (firstWithCI?.confidenceInterval) {
        setConfidenceInfo([
          { label: '模拟次数', value: '10,000 次' },
          { label: '置信区间', value: '95%' },
          { label: '概率下限', value: `${Math.round(firstWithCI.confidenceInterval.lower * 100)}%` },
          { label: '概率上限', value: `${Math.round(firstWithCI.confidenceInterval.upper * 100)}%` },
        ]);
      }
    } catch (err) {
      console.error('加载完成概率数据失败:', err);
      const message = err instanceof Error ? err.message : '加载失败，请稍后重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // 获取概率颜色
  const getProbabilityColor = (level: string) => {
    switch (level) {
      case 'high':
        return DISPATCHER_THEME.success;
      case 'medium':
        return DISPATCHER_THEME.warning;
      case 'low':
        return DISPATCHER_THEME.danger;
      default:
        return '#666';
    }
  };

  // 获取因素颜色
  const getFactorColors = (type: string): [string, string] => {
    switch (type) {
      case 'positive':
        return [DISPATCHER_THEME.success, '#95de64'];
      case 'neutral':
        return [DISPATCHER_THEME.info, '#69c0ff'];
      case 'negative':
        return [DISPATCHER_THEME.danger, '#ff7875'];
      default:
        return ['#d9d9d9', '#f0f0f0'];
    }
  };

  // 渲染批次概率项
  const renderBatchItem = (batch: BatchProbability) => (
    <View
      key={batch.id}
      style={[
        styles.batchItem,
        batch.isRisk && styles.batchItemRisk,
      ]}
    >
      <View style={styles.batchLeft}>
        <View
          style={[
            styles.batchIndicator,
            { backgroundColor: getProbabilityColor(batch.level) },
          ]}
        />
        <View>
          <Text style={styles.batchName}>
            {batch.name} {batch.isRisk && '🚨'}
          </Text>
          <Text style={styles.batchMeta}>
            交期: {batch.deadline} | 剩余 {batch.remainingHours}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.batchProbability,
          { color: getProbabilityColor(batch.level) },
        ]}
      >
        {batch.probability}%
      </Text>
    </View>
  );

  // 渲染影响因素
  const renderFactor = (factor: Factor) => (
    <View key={factor.id} style={styles.factorItem}>
      <View style={styles.factorHeader}>
        <Text style={styles.factorName}>{factor.name}</Text>
        <Text
          style={[
            styles.factorValue,
            { color: getFactorColors(factor.type)[0] },
          ]}
        >
          {factor.value} {factor.impact}
        </Text>
      </View>
      <View style={styles.factorBar}>
        <LinearGradient
          colors={getFactorColors(factor.type)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.factorBarFill, { width: `${factor.percentage}%` }]}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>完成概率分析</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>Monte Carlo</Text>
        </View>
      </LinearGradient>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
          <Text style={styles.loadingText}>正在分析完成概率...</Text>
        </View>
      )}

      {/* Error State */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={DISPATCHER_THEME.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>重新加载</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {!loading && !error && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[DISPATCHER_THEME.primary]}
              tintColor={DISPATCHER_THEME.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* 大仪表盘 */}
          <View style={styles.gaugeCard}>
            <View style={styles.gaugeCircle}>
              <View style={styles.gaugeInner}>
                <Text style={styles.gaugeValue}>{overallProbability}%</Text>
                <Text style={styles.gaugeLabel}>按时完成概率</Text>
              </View>
            </View>
            <Text style={styles.gaugeDesc}>
              基于 <Text style={styles.gaugeHighlight}>Monte Carlo 模拟 10,000 次</Text>
              {'\n'}考虑效率波动、人员变动、设备状态等因素
            </Text>
          </View>

          {/* 概率统计 */}
          <View style={styles.probStats}>
            <View style={styles.probStatItem}>
              <Text style={[styles.probStatValue, { color: DISPATCHER_THEME.success }]}>
                {probStats.high}
              </Text>
              <Text style={styles.probStatLabel}>高概率(&gt;80%)</Text>
            </View>
            <View style={styles.probStatItem}>
              <Text style={[styles.probStatValue, { color: DISPATCHER_THEME.warning }]}>
                {probStats.medium}
              </Text>
              <Text style={styles.probStatLabel}>中等(60-80%)</Text>
            </View>
            <View style={styles.probStatItem}>
              <Text style={[styles.probStatValue, { color: DISPATCHER_THEME.danger }]}>
                {probStats.low}
              </Text>
              <Text style={styles.probStatLabel}>需关注(&lt;60%)</Text>
            </View>
          </View>

          {/* 风险提示 */}
          {batchProbabilities.some(b => b.isRisk) && (
            <View style={styles.riskAlert}>
              <View style={styles.riskHeader}>
                <Text style={styles.riskIcon}>⚠️</Text>
                <Text style={styles.riskTitle}>
                  {batchProbabilities.filter(b => b.isRisk).length} 个批次存在风险
                </Text>
              </View>
              <Text style={styles.riskContent}>
                {batchProbabilities.filter(b => b.isRisk).map(b => b.name).join('、')} 完成概率偏低，建议增派人员或调整优先级。
              </Text>
              <TouchableOpacity style={styles.riskAction}>
                <Text style={styles.riskActionText}>查看优化建议</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 批次概率列表 */}
          <View style={styles.batchCard}>
            <View style={styles.batchHeader}>
              <Text style={styles.batchHeaderTitle}>各批次完成概率</Text>
              <Text style={styles.batchHeaderDate}>{getToday()}</Text>
            </View>
            {batchProbabilities.length > 0 ? (
              batchProbabilities.map(renderBatchItem)
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>暂无排程数据</Text>
              </View>
            )}
          </View>

          {/* 影响因素分析 */}
          {factors.length > 0 && (
            <View style={styles.factorsCard}>
              <View style={styles.factorsTitleRow}>
                <Text style={styles.factorsIcon}>📊</Text>
                <Text style={styles.factorsTitle}>影响因素分析</Text>
              </View>
              {factors.map(renderFactor)}
            </View>
          )}

          {/* AI洞察 */}
          {aiInsights.length > 0 && (
            <View style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <LinearGradient
                  colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                  style={styles.insightIcon}
                >
                  <Text style={styles.insightIconText}>🤖</Text>
                </LinearGradient>
                <Text style={styles.insightTitle}>AI 分析洞察</Text>
              </View>
              <View style={styles.insightContent}>
                {aiInsights.map((insight, index) => (
                  <Text key={index} style={styles.insightText}>
                    {insight}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* 置信区间说明 */}
          <View style={[styles.confidenceCard, { marginBottom: 100 }]}>
            <Text style={styles.confidenceTitle}>模拟参数说明</Text>
            {confidenceInfo.map((item, index) => (
              <View key={index} style={styles.confidenceRow}>
                <Text style={styles.confidenceLabel}>{item.label}</Text>
                <Text style={styles.confidenceValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DISPATCHER_THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 14,
    color: DISPATCHER_THEME.danger,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: DISPATCHER_THEME.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
  },
  headerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    fontSize: 11,
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  gaugeCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    shadowColor: DISPATCHER_THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  gaugeCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 12,
    borderColor: DISPATCHER_THEME.success,
  },
  gaugeInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 48,
    fontWeight: '700',
    color: DISPATCHER_THEME.success,
  },
  gaugeLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  gaugeDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  gaugeHighlight: {
    color: DISPATCHER_THEME.primary,
    fontWeight: '600',
  },
  probStats: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  probStatItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  probStatValue: {
    fontSize: 24,
    fontWeight: '600',
  },
  probStatLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  riskAlert: {
    backgroundColor: '#fff2f0',
    borderWidth: 1,
    borderColor: '#ffccc7',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 14,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  riskIcon: {
    fontSize: 20,
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: DISPATCHER_THEME.danger,
  },
  riskContent: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  riskAction: {
    marginTop: 10,
    backgroundColor: DISPATCHER_THEME.danger,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  riskActionText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  batchCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  batchHeaderTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  batchHeaderDate: {
    fontSize: 12,
    color: '#999',
  },
  batchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  batchItemRisk: {
    backgroundColor: '#fff2f0',
  },
  batchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  batchIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  batchName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  batchMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  batchProbability: {
    fontSize: 20,
    fontWeight: '600',
  },
  factorsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  factorsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  factorsIcon: {
    fontSize: 18,
  },
  factorsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  factorItem: {
    marginBottom: 16,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  factorName: {
    fontSize: 14,
    color: '#666',
  },
  factorValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  factorBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  factorBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  insightCard: {
    backgroundColor: '#f9f5ff',
    borderWidth: 1,
    borderColor: '#d3adf7',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightIconText: {
    fontSize: 16,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: DISPATCHER_THEME.primary,
  },
  insightContent: {
    gap: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  insightHighlight: {
    backgroundColor: 'rgba(114, 46, 209, 0.1)',
    color: DISPATCHER_THEME.primary,
    fontWeight: '500',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  confidenceCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  confidenceTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#666',
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
});
