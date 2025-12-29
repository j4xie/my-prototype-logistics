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
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

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

// Mock 数据
const mockOverallProbability = 85;

const mockProbStats = {
  high: 3,
  medium: 1,
  low: 1,
};

const mockBatchProbabilities: BatchProbability[] = [
  {
    id: '1',
    name: '带鱼片 100kg',
    deadline: '12-28 18:00',
    remainingHours: '6h',
    probability: 58,
    level: 'low',
    isRisk: true,
  },
  {
    id: '2',
    name: '黄鱼片 80kg',
    deadline: '12-28 20:00',
    remainingHours: '8h',
    probability: 72,
    level: 'medium',
    isRisk: false,
  },
  {
    id: '3',
    name: '鱿鱼圈 60kg',
    deadline: '12-29 12:00',
    remainingHours: '24h',
    probability: 91,
    level: 'high',
    isRisk: false,
  },
  {
    id: '4',
    name: '虾仁 120kg',
    deadline: '12-29 18:00',
    remainingHours: '30h',
    probability: 95,
    level: 'high',
    isRisk: false,
  },
  {
    id: '5',
    name: '墨鱼仔 50kg',
    deadline: '12-30 12:00',
    remainingHours: '48h',
    probability: 98,
    level: 'high',
    isRisk: false,
  },
];

const mockFactors: Factor[] = [
  {
    id: '1',
    name: '人员配置充足度',
    value: '良好',
    impact: '+15%',
    percentage: 85,
    type: 'positive',
  },
  {
    id: '2',
    name: '设备可用率',
    value: '正常',
    impact: '+5%',
    percentage: 78,
    type: 'neutral',
  },
  {
    id: '3',
    name: '原料匹配度',
    value: '优秀',
    impact: '+20%',
    percentage: 95,
    type: 'positive',
  },
  {
    id: '4',
    name: '时间紧迫度',
    value: '紧张',
    impact: '-25%',
    percentage: 35,
    type: 'negative',
  },
];

const mockConfidenceInfo: ConfidenceInfo[] = [
  { label: '模拟次数', value: '10,000 次' },
  { label: '置信区间', value: '95%' },
  { label: '效率标准差', value: '±15%' },
  { label: '预计完成时间', value: '17:30 ± 45min' },
  { label: '最坏情况', value: '19:15 (90%分位)' },
];

export default function AICompletionProbScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: 调用API刷新数据
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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
              <Text style={styles.gaugeValue}>{mockOverallProbability}%</Text>
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
              {mockProbStats.high}
            </Text>
            <Text style={styles.probStatLabel}>高概率(&gt;80%)</Text>
          </View>
          <View style={styles.probStatItem}>
            <Text style={[styles.probStatValue, { color: DISPATCHER_THEME.warning }]}>
              {mockProbStats.medium}
            </Text>
            <Text style={styles.probStatLabel}>中等(60-80%)</Text>
          </View>
          <View style={styles.probStatItem}>
            <Text style={[styles.probStatValue, { color: DISPATCHER_THEME.danger }]}>
              {mockProbStats.low}
            </Text>
            <Text style={styles.probStatLabel}>需关注(&lt;60%)</Text>
          </View>
        </View>

        {/* 风险提示 */}
        {mockBatchProbabilities.some(b => b.isRisk) && (
          <View style={styles.riskAlert}>
            <View style={styles.riskHeader}>
              <Text style={styles.riskIcon}>⚠️</Text>
              <Text style={styles.riskTitle}>1 个批次存在风险</Text>
            </View>
            <Text style={styles.riskContent}>
              <Text style={{ fontWeight: '600' }}>带鱼片 100kg</Text> 完成概率仅 58%，交期紧张。建议增派人员或调整优先级。
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
            <Text style={styles.batchHeaderDate}>2025-12-28</Text>
          </View>
          {mockBatchProbabilities.map(renderBatchItem)}
        </View>

        {/* 影响因素分析 */}
        <View style={styles.factorsCard}>
          <View style={styles.factorsTitleRow}>
            <Text style={styles.factorsIcon}>📊</Text>
            <Text style={styles.factorsTitle}>影响因素分析</Text>
          </View>
          {mockFactors.map(renderFactor)}
        </View>

        {/* AI洞察 */}
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
            <Text style={styles.insightText}>
              💡 <Text style={styles.insightHighlight}>带鱼片 100kg</Text> 是当前瓶颈，建议采取以下措施：
            </Text>
            <Text style={styles.insightText}>
              1. 从机动人员中抽调 <Text style={styles.insightHighlight}>2名熟练工</Text> 支援切片A线
            </Text>
            <Text style={styles.insightText}>
              2. 将 <Text style={styles.insightHighlight}>黄鱼片</Text> 延后30分钟开始，优先保证带鱼片交期
            </Text>
            <Text style={styles.insightText}>
              3. 若采纳建议，整体完成概率可提升至 <Text style={styles.insightHighlight}>92%</Text>
            </Text>
          </View>
        </View>

        {/* 置信区间说明 */}
        <View style={[styles.confidenceCard, { marginBottom: 100 }]}>
          <Text style={styles.confidenceTitle}>模拟参数说明</Text>
          {mockConfidenceInfo.map((item, index) => (
            <View key={index} style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>{item.label}</Text>
              <Text style={styles.confidenceValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DISPATCHER_THEME.background,
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
    borderRadius: 16,
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
    borderRadius: 16,
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
