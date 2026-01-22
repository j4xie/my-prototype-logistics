/**
 * AI 调度分析主页
 *
 * 功能:
 * - 调度优化总览
 * - 公平性统计与违规检测
 * - 临时工管理统计
 * - SKU复杂度漂移监控
 * - 瓶颈分析
 * - 优化建议列表
 * - 快速操作入口（重排、What-If分析等）
 *
 * @version 1.0.0
 * @since 2026-01-22
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DISPATCHER_THEME } from '../../../types/dispatcher';
import {
  schedulingOptimizationApiClient,
  SchedulingOverview,
  OptimizationSuggestion,
  BottleneckAnalysis,
  FairnessViolation,
} from '../../../services/api/schedulingOptimizationApiClient';

// 图标名称类型
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function AIScheduleAnalysisScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 数据状态
  const [overview, setOverview] = useState<SchedulingOverview | null>(null);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckAnalysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setError(null);

      // 并行请求
      const [overviewRes, suggestionsRes, bottlenecksRes] = await Promise.all([
        schedulingOptimizationApiClient.getOverview(),
        schedulingOptimizationApiClient.getSuggestions({ limit: 5 }),
        schedulingOptimizationApiClient.getBottlenecks(),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      }

      if (suggestionsRes.success && suggestionsRes.data) {
        setSuggestions(suggestionsRes.data);
      }

      if (bottlenecksRes.success && bottlenecksRes.data) {
        setBottlenecks(bottlenecksRes.data);
      }
    } catch (err) {
      console.error('加载调度分析数据失败:', err);
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

  // 执行分析
  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const result = await schedulingOptimizationApiClient.analyze({ scope: 'full' });
      if (result.success && result.data) {
        setSuggestions(result.data.suggestions || []);
        setBottlenecks(result.data.bottlenecks || []);
        Alert.alert('分析完成', `发现 ${result.data.suggestions?.length || 0} 条优化建议`);
      } else {
        throw new Error(result.message || '分析失败');
      }
    } catch (err) {
      console.error('执行分析失败:', err);
      Alert.alert('错误', err instanceof Error ? err.message : '分析失败');
    } finally {
      setAnalyzing(false);
    }
  };

  // 触发自适应学习
  const handleTriggerAdaptation = async () => {
    try {
      const result = await schedulingOptimizationApiClient.triggerAdaptation();
      if (result.success) {
        Alert.alert('成功', '自适应学习已触发');
        loadData();
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      Alert.alert('错误', err instanceof Error ? err.message : '触发失败');
    }
  };

  // 获取建议类型图标
  const getSuggestionIcon = (type: string): IconName => {
    switch (type) {
      case 'worker_reallocation': return 'account-switch';
      case 'skill_training': return 'school';
      case 'schedule_adjustment': return 'calendar-clock';
      case 'fairness_correction': return 'scale-balance';
      case 'efficiency_improvement': return 'trending-up';
      default: return 'lightbulb-outline';
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return DISPATCHER_THEME.danger;
      case 'high': return '#fa8c16';
      case 'medium': return '#faad14';
      case 'low': return DISPATCHER_THEME.success;
      default: return '#999';
    }
  };

  // 获取瓶颈严重性颜色
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return DISPATCHER_THEME.danger;
      case 'high': return '#fa8c16';
      case 'medium': return '#faad14';
      case 'low': return DISPATCHER_THEME.success;
      default: return '#999';
    }
  };

  // 渲染统计卡片
  const renderStatCard = (
    icon: IconName,
    label: string,
    value: string | number,
    subValue?: string,
    color?: string
  ) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: (color || DISPATCHER_THEME.primary) + '15' }]}>
        <MaterialCommunityIcons
          name={icon}
          size={24}
          color={color || DISPATCHER_THEME.primary}
        />
      </View>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {subValue && <Text style={styles.statSubValue}>{subValue}</Text>}
    </View>
  );

  // 渲染建议项
  const renderSuggestionItem = (suggestion: OptimizationSuggestion) => (
    <TouchableOpacity key={suggestion.id} style={styles.suggestionItem}>
      <View style={styles.suggestionLeft}>
        <View style={[styles.suggestionIcon, { backgroundColor: getPriorityColor(suggestion.priority) + '15' }]}>
          <MaterialCommunityIcons
            name={getSuggestionIcon(suggestion.type)}
            size={20}
            color={getPriorityColor(suggestion.priority)}
          />
        </View>
        <View style={styles.suggestionContent}>
          <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
          <Text style={styles.suggestionDesc} numberOfLines={2}>{suggestion.description}</Text>
          <View style={styles.suggestionMeta}>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(suggestion.priority) + '20' }]}>
              <Text style={[styles.priorityText, { color: getPriorityColor(suggestion.priority) }]}>
                {suggestion.priority === 'critical' ? '紧急' :
                 suggestion.priority === 'high' ? '高' :
                 suggestion.priority === 'medium' ? '中' : '低'}
              </Text>
            </View>
            <Text style={styles.improvementText}>
              预计提升 {Math.round(suggestion.estimatedImprovement * 100)}%
            </Text>
          </View>
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  // 渲染瓶颈项
  const renderBottleneckItem = (bottleneck: BottleneckAnalysis, index: number) => (
    <View key={index} style={styles.bottleneckItem}>
      <View style={[styles.bottleneckIndicator, { backgroundColor: getSeverityColor(bottleneck.severity) }]} />
      <View style={styles.bottleneckContent}>
        <View style={styles.bottleneckHeader}>
          <Text style={styles.bottleneckType}>
            {bottleneck.bottleneckType === 'worker_shortage' ? '人员不足' :
             bottleneck.bottleneckType === 'skill_gap' ? '技能缺口' :
             bottleneck.bottleneckType === 'equipment_constraint' ? '设备限制' :
             bottleneck.bottleneckType === 'material_delay' ? '物料延迟' : '排程冲突'}
          </Text>
          <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(bottleneck.severity) + '20' }]}>
            <Text style={[styles.severityText, { color: getSeverityColor(bottleneck.severity) }]}>
              {bottleneck.severity === 'critical' ? '严重' :
               bottleneck.severity === 'high' ? '高' :
               bottleneck.severity === 'medium' ? '中' : '低'}
            </Text>
          </View>
        </View>
        <Text style={styles.bottleneckDesc}>{bottleneck.description}</Text>
        <Text style={styles.bottleneckImpact}>
          影响 {bottleneck.affectedTasks} 个任务，预计延迟 {bottleneck.estimatedDelay} 分钟
        </Text>
      </View>
    </View>
  );

  // 渲染违规项
  const renderViolationItem = (violation: FairnessViolation, index: number) => (
    <View key={index} style={styles.violationItem}>
      <MaterialCommunityIcons
        name={violation.violationType === 'under_assignment' ? 'arrow-down-circle' :
              violation.violationType === 'over_assignment' ? 'arrow-up-circle' :
              violation.violationType === 'skill_mismatch' ? 'alert-circle' : 'alert'}
        size={20}
        color={getSeverityColor(violation.severity)}
      />
      <View style={styles.violationContent}>
        <Text style={styles.violationText}>{violation.description}</Text>
        <Text style={styles.violationAction}>{violation.suggestedAction}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary, DISPATCHER_THEME.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="chart-box" size={32} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>AI 调度分析</Text>
        <Text style={styles.headerSubtitle}>智能优化 + 公平性监控 + 瓶颈检测</Text>
      </LinearGradient>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
          <Text style={styles.loadingText}>正在加载分析数据...</Text>
        </View>
      )}

      {/* Error State */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={DISPATCHER_THEME.danger} />
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
          {/* 快捷操作 */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={handleAnalyze}
              disabled={analyzing}
            >
              <LinearGradient
                colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                style={styles.quickActionGradient}
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialCommunityIcons name="magnify-scan" size={20} color="#fff" />
                )}
                <Text style={styles.quickActionText}>
                  {analyzing ? '分析中...' : '执行分析'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => navigation.navigate('AIReschedule')}
            >
              <View style={styles.quickActionOutline}>
                <MaterialCommunityIcons name="calendar-refresh" size={20} color={DISPATCHER_THEME.primary} />
                <Text style={[styles.quickActionText, { color: DISPATCHER_THEME.primary }]}>AI重排</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => navigation.navigate('AIProbabilityDetail')}
            >
              <View style={styles.quickActionOutline}>
                <MaterialCommunityIcons name="chart-line" size={20} color={DISPATCHER_THEME.primary} />
                <Text style={[styles.quickActionText, { color: DISPATCHER_THEME.primary }]}>概率详情</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 总览统计 */}
          {overview && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="view-dashboard" size={20} color="#333" />
                  <Text style={styles.cardTitle}>调度总览</Text>
                </View>
                <TouchableOpacity onPress={handleTriggerAdaptation}>
                  <Text style={styles.actionLink}>自适应学习</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsGrid}>
                {renderStatCard(
                  'scale-balance',
                  '公平性评分',
                  Math.round(overview.fairnessStats?.fairnessScore || 0),
                  overview.fairnessStats?.giniCoefficient
                    ? `基尼系数: ${overview.fairnessStats.giniCoefficient.toFixed(3)}`
                    : undefined,
                  (overview.fairnessStats?.fairnessScore || 0) >= 80 ? DISPATCHER_THEME.success : '#fa8c16'
                )}
                {renderStatCard(
                  'account-clock',
                  '临时工',
                  overview.tempWorkerStats?.activeTempWorkers || 0,
                  `转正率: ${Math.round((overview.tempWorkerStats?.conversionRate || 0) * 100)}%`
                )}
                {renderStatCard(
                  'alert-circle',
                  '违规数',
                  overview.violationCount || 0,
                  undefined,
                  (overview.violationCount || 0) > 0 ? DISPATCHER_THEME.danger : DISPATCHER_THEME.success
                )}
                {renderStatCard(
                  'trending-up',
                  'SKU漂移',
                  overview.skuDriftCount || 0,
                  `转正候选: ${overview.conversionCandidates || 0}`,
                  (overview.skuDriftCount || 0) > 0 ? '#fa8c16' : DISPATCHER_THEME.success
                )}
              </View>
            </View>
          )}

          {/* 公平性违规 */}
          {overview && overview.fairnessViolations && overview.fairnessViolations.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="alert-octagon" size={20} color={DISPATCHER_THEME.danger} />
                  <Text style={styles.cardTitle}>公平性违规</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{overview.fairnessViolations.length}</Text>
                  </View>
                </View>
              </View>
              {overview.fairnessViolations.slice(0, 3).map(renderViolationItem)}
              {overview.fairnessViolations.length > 3 && (
                <TouchableOpacity style={styles.viewMoreBtn}>
                  <Text style={styles.viewMoreText}>查看全部 {overview.fairnessViolations.length} 条</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 瓶颈分析 */}
          {bottlenecks.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="traffic-cone" size={20} color="#fa8c16" />
                  <Text style={styles.cardTitle}>瓶颈分析</Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI检测</Text>
                  </View>
                </View>
              </View>
              {bottlenecks.slice(0, 3).map(renderBottleneckItem)}
            </View>
          )}

          {/* 优化建议 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="lightbulb-on" size={20} color="#52c41a" />
                <Text style={styles.cardTitle}>优化建议</Text>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>AI推荐</Text>
                </View>
              </View>
            </View>

            {suggestions.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="check-circle-outline" size={48} color="#52c41a" />
                <Text style={styles.emptyText}>当前无优化建议</Text>
                <Text style={styles.emptySubtext}>调度运行良好，保持关注</Text>
              </View>
            ) : (
              suggestions.map(renderSuggestionItem)
            )}
          </View>

          {/* 配置信息 */}
          {overview?.config && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="cog" size={20} color="#666" />
                  <Text style={styles.cardTitle}>调度配置</Text>
                </View>
              </View>
              <View style={styles.configGrid}>
                <View style={styles.configItem}>
                  <Text style={styles.configLabel}>探索率</Text>
                  <Text style={styles.configValue}>
                    {(overview.config.explorationRate * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.configItem}>
                  <Text style={styles.configLabel}>公平权重</Text>
                  <Text style={styles.configValue}>
                    {(overview.config.fairnessWeight * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.configItem}>
                  <Text style={styles.configLabel}>效率权重</Text>
                  <Text style={styles.configValue}>
                    {(overview.config.efficiencyWeight * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.configItem}>
                  <Text style={styles.configLabel}>自适应</Text>
                  <Text style={[
                    styles.configValue,
                    { color: overview.config.autoAdaptEnabled ? DISPATCHER_THEME.success : '#999' }
                  ]}>
                    {overview.config.autoAdaptEnabled ? '已启用' : '已禁用'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 12,
    top: 16,
    padding: 4,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  quickActionBtn: {
    flex: 1,
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  quickActionOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: DISPATCHER_THEME.primary,
    backgroundColor: '#fff',
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: DISPATCHER_THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  actionLink: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  aiBadge: {
    backgroundColor: DISPATCHER_THEME.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fff',
  },
  countBadge: {
    backgroundColor: DISPATCHER_THEME.danger,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: DISPATCHER_THEME.primary,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statSubValue: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  suggestionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  suggestionDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '500',
  },
  improvementText: {
    fontSize: 11,
    color: DISPATCHER_THEME.success,
  },
  bottleneckItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  bottleneckIndicator: {
    width: 4,
    height: '100%',
    minHeight: 60,
    borderRadius: 2,
  },
  bottleneckContent: {
    flex: 1,
  },
  bottleneckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bottleneckType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '500',
  },
  bottleneckDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  bottleneckImpact: {
    fontSize: 11,
    color: '#999',
  },
  violationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    backgroundColor: '#fff2f0',
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  violationContent: {
    flex: 1,
  },
  violationText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  violationAction: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  viewMoreBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewMoreText: {
    fontSize: 13,
    color: DISPATCHER_THEME.primary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  configGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  configItem: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  configLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  configValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
});
