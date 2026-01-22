/**
 * 完成概率详情页
 *
 * 功能:
 * - 选择排程查看完成概率
 * - Monte Carlo 模拟详情
 * - 影响因素分解
 * - 置信区间可视化
 * - 风险等级评估
 * - AI 洞察与建议
 * - 历史趋势对比
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { DISPATCHER_THEME, SchedulingPlan, LineSchedule } from '../../../types/dispatcher';
import {
  schedulingApiClient,
  CompletionProbabilityResponse,
} from '../../../services/api/schedulingApiClient';

// 图标名称类型
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 路由参数类型
type RouteParams = {
  AIProbabilityDetail: {
    scheduleId?: string;
    planId?: string;
  };
};

export default function AIProbabilityDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'AIProbabilityDetail'>>();
  const { scheduleId: initialScheduleId, planId: initialPlanId } = route.params || {};

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 计划和排程列表
  const [plans, setPlans] = useState<SchedulingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialPlanId || null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(initialScheduleId || null);

  // 概率数据
  const [probabilities, setProbabilities] = useState<CompletionProbabilityResponse[]>([]);
  const [selectedProbability, setSelectedProbability] = useState<CompletionProbabilityResponse | null>(null);
  const [loadingProbability, setLoadingProbability] = useState(false);

  // 加载计划列表
  const loadPlans = useCallback(async () => {
    try {
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      const response = await schedulingApiClient.getPlans({
        startDate: today,
        status: 'confirmed,in_progress',
        page: 0,
        size: 20,
      });

      if (response.success && response.data) {
        const planList = response.data.content || [];
        setPlans(planList);

        // 默认选中第一个
        if (planList.length > 0 && !selectedPlanId) {
          setSelectedPlanId(planList[0].id);
        }
      }
    } catch (err) {
      console.error('加载计划列表失败:', err);
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId]);

  // 加载计划的概率数据
  const loadProbabilities = useCallback(async (planId: string) => {
    setLoadingProbability(true);
    try {
      const response = await schedulingApiClient.calculateBatchProbabilities(planId);
      if (response.success && response.data) {
        setProbabilities(response.data);
        // 如果有预选的 scheduleId，找到对应的概率数据
        if (initialScheduleId) {
          const found = response.data.find(p => p.scheduleId === initialScheduleId);
          if (found) {
            setSelectedProbability(found);
            setSelectedScheduleId(initialScheduleId);
          }
        } else if (response.data.length > 0) {
          // 默认选中第一个
          setSelectedProbability(response.data[0]);
          setSelectedScheduleId(response.data[0].scheduleId);
        }
      }
    } catch (err) {
      console.error('加载概率数据失败:', err);
    } finally {
      setLoadingProbability(false);
    }
  }, [initialScheduleId]);

  // 加载单个排程的概率
  const loadSingleProbability = useCallback(async (scheduleId: string) => {
    setLoadingProbability(true);
    try {
      const response = await schedulingApiClient.calculateCompletionProbability(scheduleId);
      if (response.success && response.data) {
        setSelectedProbability(response.data);
      }
    } catch (err) {
      console.error('加载概率详情失败:', err);
    } finally {
      setLoadingProbability(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // 计划变化时加载概率
  useEffect(() => {
    if (selectedPlanId) {
      loadProbabilities(selectedPlanId);
    }
  }, [selectedPlanId, loadProbabilities]);

  // 选择排程时加载详情
  useEffect(() => {
    if (selectedScheduleId && !selectedProbability) {
      loadSingleProbability(selectedScheduleId);
    }
  }, [selectedScheduleId, selectedProbability, loadSingleProbability]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPlans();
    if (selectedPlanId) {
      await loadProbabilities(selectedPlanId);
    }
    setRefreshing(false);
  }, [loadPlans, loadProbabilities, selectedPlanId]);

  // 选择排程
  const handleSelectSchedule = (prob: CompletionProbabilityResponse) => {
    setSelectedScheduleId(prob.scheduleId);
    setSelectedProbability(prob);
  };

  // 获取风险等级颜色
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return DISPATCHER_THEME.success;
      case 'medium': return '#fa8c16';
      case 'high': return DISPATCHER_THEME.danger;
      default: return '#999';
    }
  };

  // 获取风险等级文本
  const getRiskText = (level: string) => {
    switch (level) {
      case 'low': return '低风险';
      case 'medium': return '中等风险';
      case 'high': return '高风险';
      default: return '未知';
    }
  };

  // 获取风险等级图标
  const getRiskIcon = (level: string): IconName => {
    switch (level) {
      case 'low': return 'shield-check';
      case 'medium': return 'shield-alert';
      case 'high': return 'shield-off';
      default: return 'shield';
    }
  };

  // 获取因素颜色
  const getFactorColor = (value: number) => {
    if (value >= 0.8) return DISPATCHER_THEME.success;
    if (value >= 0.6) return '#fa8c16';
    return DISPATCHER_THEME.danger;
  };

  // 渲染概率仪表盘
  const renderProbabilityGauge = () => {
    if (!selectedProbability) return null;

    const probability = Math.round(selectedProbability.probability * 100);
    const gaugeColor = probability >= 80 ? DISPATCHER_THEME.success :
                       probability >= 60 ? '#fa8c16' : DISPATCHER_THEME.danger;

    return (
      <View style={styles.gaugeContainer}>
        <View style={[styles.gaugeCircle, { borderColor: gaugeColor }]}>
          <View style={styles.gaugeInner}>
            <Text style={[styles.gaugeValue, { color: gaugeColor }]}>{probability}%</Text>
            <Text style={styles.gaugeLabel}>完成概率</Text>
          </View>
        </View>
        <View style={styles.gaugeMeta}>
          <View style={[styles.riskBadge, { backgroundColor: getRiskColor(selectedProbability.riskLevel) + '20' }]}>
            <MaterialCommunityIcons
              name={getRiskIcon(selectedProbability.riskLevel)}
              size={16}
              color={getRiskColor(selectedProbability.riskLevel)}
            />
            <Text style={[styles.riskText, { color: getRiskColor(selectedProbability.riskLevel) }]}>
              {getRiskText(selectedProbability.riskLevel)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // 渲染置信区间
  const renderConfidenceInterval = () => {
    if (!selectedProbability?.confidenceInterval) return null;

    const { lower, upper } = selectedProbability.confidenceInterval;
    const lowerPct = Math.round(lower * 100);
    const upperPct = Math.round(upper * 100);
    const currentPct = Math.round(selectedProbability.probability * 100);
    const range = upperPct - lowerPct;
    const position = ((currentPct - lowerPct) / range) * 100;

    return (
      <View style={styles.confidenceContainer}>
        <View style={styles.confidenceHeader}>
          <Text style={styles.confidenceTitle}>95% 置信区间</Text>
          <Text style={styles.confidenceRange}>{lowerPct}% - {upperPct}%</Text>
        </View>
        <View style={styles.confidenceBar}>
          <View style={styles.confidenceBarFill}>
            <View
              style={[
                styles.confidenceMarker,
                { left: `${Math.min(Math.max(position, 5), 95)}%` },
              ]}
            />
          </View>
        </View>
        <View style={styles.confidenceLabels}>
          <Text style={styles.confidenceLabelLeft}>{lowerPct}%</Text>
          <Text style={styles.confidenceLabelCenter}>{currentPct}%</Text>
          <Text style={styles.confidenceLabelRight}>{upperPct}%</Text>
        </View>
      </View>
    );
  };

  // 渲染因素分析
  const renderFactorAnalysis = () => {
    if (!selectedProbability?.factors) return null;

    const factors = selectedProbability.factors;
    const factorItems = [
      { key: 'workerEfficiency', label: '人员效率', icon: 'account-hard-hat' as IconName, value: factors.workerEfficiency },
      { key: 'equipmentStatus', label: '设备状态', icon: 'cog' as IconName, value: factors.equipmentStatus },
      { key: 'materialAvailability', label: '物料可用性', icon: 'package-variant' as IconName, value: factors.materialAvailability },
      { key: 'timeBuffer', label: '时间缓冲', icon: 'clock-outline' as IconName, value: factors.timeBuffer },
    ];

    return (
      <View style={styles.factorsContainer}>
        {factorItems.map((factor) => (
          <View key={factor.key} style={styles.factorItem}>
            <View style={styles.factorHeader}>
              <View style={styles.factorLeft}>
                <MaterialCommunityIcons
                  name={factor.icon}
                  size={18}
                  color={getFactorColor(factor.value)}
                />
                <Text style={styles.factorLabel}>{factor.label}</Text>
              </View>
              <Text style={[styles.factorValue, { color: getFactorColor(factor.value) }]}>
                {Math.round(factor.value * 100)}%
              </Text>
            </View>
            <View style={styles.factorBar}>
              <LinearGradient
                colors={[getFactorColor(factor.value), getFactorColor(factor.value) + '60']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.factorBarFill, { width: `${factor.value * 100}%` }]}
              />
            </View>
          </View>
        ))}
      </View>
    );
  };

  // 渲染建议列表
  const renderSuggestions = () => {
    if (!selectedProbability?.suggestions || selectedProbability.suggestions.length === 0) {
      return null;
    }

    return (
      <View style={styles.suggestionsContainer}>
        {selectedProbability.suggestions.map((suggestion, index) => (
          <View key={index} style={styles.suggestionItem}>
            <View style={styles.suggestionBullet}>
              <Text style={styles.suggestionBulletText}>{index + 1}</Text>
            </View>
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </View>
        ))}
      </View>
    );
  };

  // 渲染 LLM 分析
  const renderLLMAnalysis = () => {
    if (!selectedProbability?.llmAnalysis) return null;

    return (
      <View style={styles.llmContainer}>
        <View style={styles.llmHeader}>
          <LinearGradient
            colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
            style={styles.llmIcon}
          >
            <MaterialCommunityIcons name="robot" size={20} color="#fff" />
          </LinearGradient>
          <Text style={styles.llmTitle}>AI 深度分析</Text>
        </View>
        <Text style={styles.llmText}>{selectedProbability.llmAnalysis}</Text>
      </View>
    );
  };

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
          <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={32} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>完成概率详情</Text>
        <Text style={styles.headerSubtitle}>Monte Carlo 模拟 + 多因素分析</Text>
      </LinearGradient>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
          <Text style={styles.loadingText}>正在加载数据...</Text>
        </View>
      )}

      {/* Error State */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={DISPATCHER_THEME.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPlans}>
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
          {/* 计划选择 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="clipboard-list" size={20} color="#333" />
                <Text style={styles.cardTitle}>选择计划</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.planScroll}
            >
              {plans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planChip,
                    selectedPlanId === plan.id && styles.planChipSelected,
                  ]}
                  onPress={() => setSelectedPlanId(plan.id)}
                >
                  <Text style={[
                    styles.planChipText,
                    selectedPlanId === plan.id && styles.planChipTextSelected,
                  ]}>
                    {plan.planDate}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 排程列表 */}
          {probabilities.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#333" />
                  <Text style={styles.cardTitle}>排程概率</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{probabilities.length} 个</Text>
                  </View>
                </View>
              </View>

              {probabilities.map((prob) => {
                const probability = Math.round(prob.probability * 100);
                const isSelected = selectedScheduleId === prob.scheduleId;

                return (
                  <TouchableOpacity
                    key={prob.scheduleId}
                    style={[
                      styles.scheduleItem,
                      isSelected && styles.scheduleItemSelected,
                    ]}
                    onPress={() => handleSelectSchedule(prob)}
                  >
                    <View style={styles.scheduleLeft}>
                      <View style={[
                        styles.probabilityIndicator,
                        { backgroundColor: getRiskColor(prob.riskLevel) },
                      ]} />
                      <View>
                        <Text style={styles.scheduleName}>
                          {prob.scheduleName || `排程 ${prob.scheduleId.substring(0, 8)}`}
                        </Text>
                        <Text style={styles.scheduleMeta}>
                          风险: {getRiskText(prob.riskLevel)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.scheduleRight}>
                      <Text style={[
                        styles.scheduleProbability,
                        { color: getRiskColor(prob.riskLevel) },
                      ]}>
                        {probability}%
                      </Text>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={20}
                          color={DISPATCHER_THEME.primary}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* 概率详情 */}
          {loadingProbability && (
            <View style={styles.loadingProbability}>
              <ActivityIndicator size="small" color={DISPATCHER_THEME.primary} />
              <Text style={styles.loadingProbabilityText}>正在计算概率...</Text>
            </View>
          )}

          {selectedProbability && !loadingProbability && (
            <>
              {/* 概率仪表盘 */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <MaterialCommunityIcons name="speedometer" size={20} color="#333" />
                    <Text style={styles.cardTitle}>完成概率</Text>
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>Monte Carlo</Text>
                    </View>
                  </View>
                </View>
                {renderProbabilityGauge()}
              </View>

              {/* 置信区间 */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="#333" />
                    <Text style={styles.cardTitle}>置信区间</Text>
                  </View>
                </View>
                {renderConfidenceInterval()}
                <View style={styles.simulationInfo}>
                  <MaterialCommunityIcons name="information" size={16} color="#999" />
                  <Text style={styles.simulationInfoText}>
                    基于 10,000 次 Monte Carlo 模拟，置信水平 95%
                  </Text>
                </View>
              </View>

              {/* 因素分析 */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <MaterialCommunityIcons name="chart-bar" size={20} color="#333" />
                    <Text style={styles.cardTitle}>影响因素</Text>
                  </View>
                </View>
                {renderFactorAnalysis()}
              </View>

              {/* AI 建议 */}
              {selectedProbability.suggestions && selectedProbability.suggestions.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <MaterialCommunityIcons name="lightbulb-on" size={20} color="#52c41a" />
                      <Text style={styles.cardTitle}>优化建议</Text>
                    </View>
                  </View>
                  {renderSuggestions()}
                </View>
              )}

              {/* LLM 分析 */}
              {selectedProbability.llmAnalysis && (
                <View style={styles.card}>
                  {renderLLMAnalysis()}
                </View>
              )}
            </>
          )}

          {/* 空状态 */}
          {!selectedProbability && !loadingProbability && probabilities.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chart-line-variant" size={64} color="#ccc" />
              <Text style={styles.emptyText}>暂无概率数据</Text>
              <Text style={styles.emptySubtext}>请选择一个有排程的计划</Text>
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
  badge: {
    backgroundColor: DISPATCHER_THEME.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
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
  planScroll: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  planChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  planChipSelected: {
    backgroundColor: DISPATCHER_THEME.primary + '15',
    borderColor: DISPATCHER_THEME.primary,
  },
  planChipText: {
    fontSize: 13,
    color: '#666',
  },
  planChipTextSelected: {
    color: DISPATCHER_THEME.primary,
    fontWeight: '500',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  scheduleItemSelected: {
    backgroundColor: DISPATCHER_THEME.primary + '10',
    borderWidth: 1,
    borderColor: DISPATCHER_THEME.primary,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  probabilityIndicator: {
    width: 8,
    height: 40,
    borderRadius: 4,
  },
  scheduleName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  scheduleMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  scheduleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleProbability: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingProbability: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  loadingProbabilityText: {
    fontSize: 14,
    color: '#666',
  },
  gaugeContainer: {
    alignItems: 'center',
    padding: 20,
  },
  gaugeCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  gaugeInner: {
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 42,
    fontWeight: '700',
  },
  gaugeLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  gaugeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  riskText: {
    fontSize: 13,
    fontWeight: '500',
  },
  confidenceContainer: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  confidenceTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  confidenceRange: {
    fontSize: 14,
    color: DISPATCHER_THEME.primary,
    fontWeight: '500',
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  confidenceBarFill: {
    height: '100%',
    backgroundColor: DISPATCHER_THEME.primary + '40',
    borderRadius: 4,
    position: 'relative',
  },
  confidenceMarker: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DISPATCHER_THEME.primary,
    marginLeft: -8,
  },
  confidenceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confidenceLabelLeft: {
    fontSize: 11,
    color: '#999',
  },
  confidenceLabelCenter: {
    fontSize: 12,
    fontWeight: '600',
    color: DISPATCHER_THEME.primary,
  },
  confidenceLabelRight: {
    fontSize: 11,
    color: '#999',
  },
  simulationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  simulationInfoText: {
    fontSize: 12,
    color: '#999',
    flex: 1,
  },
  factorsContainer: {
    gap: 16,
  },
  factorItem: {},
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  factorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factorLabel: {
    fontSize: 14,
    color: '#666',
  },
  factorValue: {
    fontSize: 14,
    fontWeight: '600',
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
  suggestionsContainer: {
    gap: 10,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  suggestionBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: DISPATCHER_THEME.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionBulletText: {
    fontSize: 12,
    fontWeight: '600',
    color: DISPATCHER_THEME.primary,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  llmContainer: {
    padding: 12,
    backgroundColor: '#f9f5ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d3adf7',
  },
  llmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  llmIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  llmTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: DISPATCHER_THEME.primary,
  },
  llmText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
});
