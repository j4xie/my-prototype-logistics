/**
 * AI 重排建议页
 *
 * 功能:
 * - 选择需要重排的调度计划
 * - 选择重排策略（最小化延迟/最大化效率/平衡公平性）
 * - What-If 场景分析
 * - 预览重排结果
 * - 确认执行重排
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DISPATCHER_THEME, SchedulingPlan } from '../../../types/dispatcher';
import {
  schedulingOptimizationApiClient,
  RescheduleResult,
  WhatIfResult,
  WhatIfRequest,
} from '../../../services/api/schedulingOptimizationApiClient';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';

// 图标名称类型
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// 重排策略类型
type RescheduleStrategy = 'minimize_delay' | 'maximize_efficiency' | 'balance_fairness';

// 策略选项
const STRATEGY_OPTIONS: { value: RescheduleStrategy; label: string; desc: string; icon: IconName }[] = [
  {
    value: 'minimize_delay',
    label: '最小化延迟',
    desc: '优先保证交付时间，减少延误',
    icon: 'clock-fast',
  },
  {
    value: 'maximize_efficiency',
    label: '最大化效率',
    desc: '优化产能利用，提升整体效率',
    icon: 'rocket-launch',
  },
  {
    value: 'balance_fairness',
    label: '平衡公平性',
    desc: '兼顾效率与人员分配公平',
    icon: 'scale-balance',
  },
];

// What-If 场景选项
const WHATIF_SCENARIOS: { value: WhatIfRequest['scenario']; label: string; icon: IconName }[] = [
  { value: 'add_worker', label: '增加工人', icon: 'account-plus' },
  { value: 'remove_worker', label: '减少工人', icon: 'account-minus' },
  { value: 'change_shift', label: '更换班次', icon: 'clock-outline' },
  { value: 'add_equipment', label: '增加设备', icon: 'hammer-wrench' },
  { value: 'priority_change', label: '调整优先级', icon: 'sort-ascending' },
];

export default function AIRescheduleScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 计划列表
  const [plans, setPlans] = useState<SchedulingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // 重排配置
  const [strategy, setStrategy] = useState<RescheduleStrategy>('minimize_delay');
  const [preserveAssignments, setPreserveAssignments] = useState(true);

  // What-If 分析
  const [showWhatIfModal, setShowWhatIfModal] = useState(false);
  const [whatIfScenario, setWhatIfScenario] = useState<WhatIfRequest['scenario'] | null>(null);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);
  const [analyzingWhatIf, setAnalyzingWhatIf] = useState(false);

  // 重排结果
  const [rescheduleResult, setRescheduleResult] = useState<RescheduleResult | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);

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
        setPlans(response.data.content || []);
        // 默认选中第一个
        if (response.data.content?.length > 0) {
          setSelectedPlanId(response.data.content[0].id);
        }
      }
    } catch (err) {
      console.error('加载计划列表失败:', err);
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPlans();
    setRefreshing(false);
  }, [loadPlans]);

  // 执行 What-If 分析
  const handleWhatIfAnalysis = async () => {
    if (!selectedPlanId || !whatIfScenario) {
      Alert.alert('提示', '请先选择计划和场景');
      return;
    }

    setAnalyzingWhatIf(true);
    try {
      const request: WhatIfRequest = {
        scenario: whatIfScenario,
        parameters: {
          planId: selectedPlanId,
          // 根据场景添加默认参数
          ...(whatIfScenario === 'add_worker' && { count: 2 }),
          ...(whatIfScenario === 'remove_worker' && { count: 1 }),
          ...(whatIfScenario === 'change_shift' && { newShift: 'full_day' }),
        },
      };

      const result = await schedulingOptimizationApiClient.whatIf(request);
      if (result.success && result.data) {
        setWhatIfResult(result.data);
      } else {
        throw new Error(result.message || 'What-If 分析失败');
      }
    } catch (err) {
      console.error('What-If 分析失败:', err);
      Alert.alert('错误', err instanceof Error ? err.message : 'What-If 分析失败');
    } finally {
      setAnalyzingWhatIf(false);
    }
  };

  // 执行重排
  const handleReschedule = async () => {
    if (!selectedPlanId) {
      Alert.alert('提示', '请先选择需要重排的计划');
      return;
    }

    Alert.alert(
      '确认重排',
      `将使用"${STRATEGY_OPTIONS.find(s => s.value === strategy)?.label}"策略对选中的计划进行重排，是否继续？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            setRescheduling(true);
            try {
              const result = await schedulingOptimizationApiClient.reschedule({
                planId: selectedPlanId,
                strategy,
                preserveAssignments,
              });

              if (result.success && result.data) {
                setRescheduleResult(result.data);
                setShowResultModal(true);
              } else {
                throw new Error(result.message || '重排失败');
              }
            } catch (err) {
              console.error('重排失败:', err);
              Alert.alert('错误', err instanceof Error ? err.message : '重排失败');
            } finally {
              setRescheduling(false);
            }
          },
        },
      ]
    );
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return DISPATCHER_THEME.primary;
      case 'in_progress': return DISPATCHER_THEME.success;
      case 'completed': return '#52c41a';
      case 'cancelled': return '#999';
      default: return '#666';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return '草稿';
      case 'confirmed': return '已确认';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      default: return status;
    }
  };

  // 格式化变化值
  const formatChange = (value: number) => {
    const percent = Math.round(value * 100);
    if (percent > 0) return `+${percent}%`;
    if (percent < 0) return `${percent}%`;
    return '0%';
  };

  // 获取变化颜色
  const getChangeColor = (value: number) => {
    if (value > 0) return DISPATCHER_THEME.success;
    if (value < 0) return DISPATCHER_THEME.danger;
    return '#999';
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
          <MaterialCommunityIcons name="calendar-refresh" size={32} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>AI 智能重排</Text>
        <Text style={styles.headerSubtitle}>优化排程 + What-If分析 + 智能建议</Text>
      </LinearGradient>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
          <Text style={styles.loadingText}>正在加载计划列表...</Text>
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
          {/* 选择计划 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="clipboard-list" size={20} color="#333" />
                <Text style={styles.cardTitle}>选择计划</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{plans.length} 个</Text>
                </View>
              </View>
            </View>

            {plans.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank" size={48} color="#ccc" />
                <Text style={styles.emptyText}>暂无可重排的计划</Text>
              </View>
            ) : (
              plans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planItem,
                    selectedPlanId === plan.id && styles.planItemSelected,
                  ]}
                  onPress={() => setSelectedPlanId(plan.id)}
                >
                  <View style={[
                    styles.radioButton,
                    selectedPlanId === plan.id && styles.radioButtonSelected,
                  ]}>
                    {selectedPlanId === plan.id && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <View style={styles.planInfo}>
                    <View style={styles.planHeader}>
                      <Text style={styles.planDate}>{plan.planDate}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(plan.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(plan.status) }]}>
                          {getStatusText(plan.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.planMeta}>
                      {plan.shiftType === 'day' ? '白班' : plan.shiftType === 'night' ? '夜班' : '全天'} |
                      工人: {plan.totalWorkers} | 预计产出: {plan.estimatedOutput}kg
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* 重排策略 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="strategy" size={20} color="#333" />
                <Text style={styles.cardTitle}>重排策略</Text>
              </View>
            </View>

            {STRATEGY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.strategyItem,
                  strategy === option.value && styles.strategyItemSelected,
                ]}
                onPress={() => setStrategy(option.value)}
              >
                <View style={[
                  styles.strategyIcon,
                  strategy === option.value && styles.strategyIconSelected,
                ]}>
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={24}
                    color={strategy === option.value ? '#fff' : DISPATCHER_THEME.primary}
                  />
                </View>
                <View style={styles.strategyContent}>
                  <Text style={[
                    styles.strategyLabel,
                    strategy === option.value && styles.strategyLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.strategyDesc}>{option.desc}</Text>
                </View>
                <View style={[
                  styles.radioButton,
                  strategy === option.value && styles.radioButtonSelected,
                ]}>
                  {strategy === option.value && <View style={styles.radioButtonInner} />}
                </View>
              </TouchableOpacity>
            ))}

            {/* 保留分配选项 */}
            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => setPreserveAssignments(!preserveAssignments)}
            >
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>保留现有工人分配</Text>
                <Text style={styles.switchDesc}>仅调整任务时间，不改变人员分配</Text>
              </View>
              <View style={[styles.switchTrack, preserveAssignments && styles.switchTrackActive]}>
                <View style={[styles.switchThumb, preserveAssignments && styles.switchThumbActive]} />
              </View>
            </TouchableOpacity>
          </View>

          {/* What-If 分析 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="flask" size={20} color="#333" />
                <Text style={styles.cardTitle}>What-If 分析</Text>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>AI模拟</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowWhatIfModal(true)}>
                <Text style={styles.actionLink}>开始分析</Text>
              </TouchableOpacity>
            </View>

            {whatIfResult ? (
              <View style={styles.whatIfResultContainer}>
                <Text style={styles.whatIfScenario}>场景: {whatIfResult.scenario}</Text>
                <View style={styles.metricsComparison}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>完成概率</Text>
                    <Text style={styles.metricValue}>
                      {Math.round(whatIfResult.originalMetrics.completionProbability * 100)}%
                      {' -> '}
                      {Math.round(whatIfResult.projectedMetrics.completionProbability * 100)}%
                    </Text>
                    <Text style={[styles.metricChange, { color: getChangeColor(whatIfResult.impact.completionChange) }]}>
                      {formatChange(whatIfResult.impact.completionChange)}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>效率</Text>
                    <Text style={styles.metricValue}>
                      {Math.round(whatIfResult.originalMetrics.efficiency * 100)}%
                      {' -> '}
                      {Math.round(whatIfResult.projectedMetrics.efficiency * 100)}%
                    </Text>
                    <Text style={[styles.metricChange, { color: getChangeColor(whatIfResult.impact.efficiencyChange) }]}>
                      {formatChange(whatIfResult.impact.efficiencyChange)}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>公平性</Text>
                    <Text style={styles.metricValue}>
                      {Math.round(whatIfResult.originalMetrics.fairnessScore * 100)}
                      {' -> '}
                      {Math.round(whatIfResult.projectedMetrics.fairnessScore * 100)}
                    </Text>
                    <Text style={[styles.metricChange, { color: getChangeColor(whatIfResult.impact.fairnessChange) }]}>
                      {formatChange(whatIfResult.impact.fairnessChange)}
                    </Text>
                  </View>
                </View>
                <View style={styles.recommendationBox}>
                  <MaterialCommunityIcons name="lightbulb-on" size={16} color={DISPATCHER_THEME.success} />
                  <Text style={styles.recommendationText}>{whatIfResult.recommendation}</Text>
                </View>
                {whatIfResult.risks && whatIfResult.risks.length > 0 && (
                  <View style={styles.risksBox}>
                    <Text style={styles.risksTitle}>潜在风险:</Text>
                    {whatIfResult.risks.map((risk, index) => (
                      <Text key={index} style={styles.riskText}>- {risk}</Text>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.whatIfPlaceholder}>
                <MaterialCommunityIcons name="flask-outline" size={40} color="#ccc" />
                <Text style={styles.whatIfPlaceholderText}>
                  点击"开始分析"模拟不同场景对排程的影响
                </Text>
              </View>
            )}
          </View>

          {/* 执行重排按钮 */}
          <TouchableOpacity
            onPress={handleReschedule}
            disabled={!selectedPlanId || rescheduling}
          >
            <LinearGradient
              colors={selectedPlanId ? [DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary] : ['#ccc', '#aaa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.rescheduleButton}
            >
              {rescheduling ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="auto-fix" size={24} color="#fff" />
                  <Text style={styles.rescheduleButtonText}>执行 AI 重排</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* What-If Modal */}
      <Modal
        visible={showWhatIfModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择分析场景</Text>
              <TouchableOpacity onPress={() => setShowWhatIfModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {WHATIF_SCENARIOS.map((scenario) => (
                <TouchableOpacity
                  key={scenario.value}
                  style={[
                    styles.scenarioItem,
                    whatIfScenario === scenario.value && styles.scenarioItemSelected,
                  ]}
                  onPress={() => setWhatIfScenario(scenario.value)}
                >
                  <View style={[
                    styles.scenarioIcon,
                    whatIfScenario === scenario.value && styles.scenarioIconSelected,
                  ]}>
                    <MaterialCommunityIcons
                      name={scenario.icon}
                      size={24}
                      color={whatIfScenario === scenario.value ? '#fff' : DISPATCHER_THEME.primary}
                    />
                  </View>
                  <Text style={styles.scenarioLabel}>{scenario.label}</Text>
                  {whatIfScenario === scenario.value && (
                    <MaterialCommunityIcons name="check" size={20} color={DISPATCHER_THEME.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowWhatIfModal(false)}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !whatIfScenario && styles.modalConfirmBtnDisabled]}
                onPress={() => {
                  setShowWhatIfModal(false);
                  handleWhatIfAnalysis();
                }}
                disabled={!whatIfScenario || analyzingWhatIf}
              >
                {analyzingWhatIf ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>开始分析</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Result Modal */}
      <Modal
        visible={showResultModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resultModalContent}>
            <View style={styles.resultHeader}>
              {rescheduleResult?.success ? (
                <MaterialCommunityIcons name="check-circle" size={48} color={DISPATCHER_THEME.success} />
              ) : (
                <MaterialCommunityIcons name="alert-circle" size={48} color={DISPATCHER_THEME.danger} />
              )}
              <Text style={styles.resultTitle}>
                {rescheduleResult?.success ? '重排成功' : '重排失败'}
              </Text>
            </View>

            {rescheduleResult?.success && (
              <>
                <View style={styles.resultStats}>
                  <View style={styles.resultStatItem}>
                    <Text style={styles.resultStatValue}>{rescheduleResult.changes.movedTasks}</Text>
                    <Text style={styles.resultStatLabel}>移动任务</Text>
                  </View>
                  <View style={styles.resultStatItem}>
                    <Text style={styles.resultStatValue}>{rescheduleResult.changes.reallocatedWorkers}</Text>
                    <Text style={styles.resultStatLabel}>重新分配工人</Text>
                  </View>
                  <View style={styles.resultStatItem}>
                    <Text style={styles.resultStatValue}>{rescheduleResult.changes.adjustedDeadlines}</Text>
                    <Text style={styles.resultStatLabel}>调整截止时间</Text>
                  </View>
                </View>

                <View style={styles.improvementBox}>
                  <Text style={styles.improvementTitle}>预期改进</Text>
                  <Text style={styles.improvementText}>
                    完成概率 +{Math.round(rescheduleResult.improvements.completionProbability * 100)}% |
                    效率 +{Math.round(rescheduleResult.improvements.efficiency * 100)}% |
                    公平性 +{Math.round(rescheduleResult.improvements.fairness * 100)}
                  </Text>
                </View>

                <Text style={styles.resultSummary}>{rescheduleResult.summary}</Text>

                {rescheduleResult.warnings && rescheduleResult.warnings.length > 0 && (
                  <View style={styles.warningsBox}>
                    {rescheduleResult.warnings.map((warning, index) => (
                      <Text key={index} style={styles.warningText}>- {warning}</Text>
                    ))}
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={styles.resultCloseBtn}
              onPress={() => {
                setShowResultModal(false);
                if (rescheduleResult?.success) {
                  navigation.goBack();
                }
              }}
            >
              <Text style={styles.resultCloseText}>
                {rescheduleResult?.success ? '完成' : '关闭'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  actionLink: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  planItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  planItemSelected: {
    backgroundColor: DISPATCHER_THEME.primary + '10',
    borderWidth: 1,
    borderColor: DISPATCHER_THEME.primary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: DISPATCHER_THEME.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DISPATCHER_THEME.primary,
  },
  planInfo: {
    flex: 1,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  planDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  planMeta: {
    fontSize: 12,
    color: '#999',
  },
  strategyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  strategyItemSelected: {
    backgroundColor: DISPATCHER_THEME.primary + '10',
    borderWidth: 1,
    borderColor: DISPATCHER_THEME.primary,
  },
  strategyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DISPATCHER_THEME.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  strategyIconSelected: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  strategyContent: {
    flex: 1,
  },
  strategyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  strategyLabelSelected: {
    color: DISPATCHER_THEME.primary,
  },
  strategyDesc: {
    fontSize: 12,
    color: '#999',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginTop: 8,
  },
  switchInfo: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  switchDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  switchTrack: {
    width: 48,
    height: 28,
    backgroundColor: '#d9d9d9',
    borderRadius: 14,
    padding: 2,
  },
  switchTrackActive: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  whatIfPlaceholder: {
    alignItems: 'center',
    padding: 24,
  },
  whatIfPlaceholderText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
  },
  whatIfResultContainer: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  whatIfScenario: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  metricsComparison: {
    flexDirection: 'row',
    gap: 8,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  metricChange: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f6ffed',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 12,
    color: '#52c41a',
    lineHeight: 18,
  },
  risksBox: {
    backgroundColor: '#fff2f0',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  risksTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: DISPATCHER_THEME.danger,
    marginBottom: 4,
  },
  riskText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  rescheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  rescheduleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  scenarioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  scenarioItemSelected: {
    backgroundColor: DISPATCHER_THEME.primary + '10',
    borderWidth: 1,
    borderColor: DISPATCHER_THEME.primary,
  },
  scenarioIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DISPATCHER_THEME.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scenarioIconSelected: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  scenarioLabel: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    color: '#666',
  },
  modalConfirmBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: DISPATCHER_THEME.primary,
    alignItems: 'center',
  },
  modalConfirmBtnDisabled: {
    backgroundColor: '#d9d9d9',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  resultModalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderRadius: 16,
    padding: 24,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  resultStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  resultStatItem: {
    alignItems: 'center',
  },
  resultStatValue: {
    fontSize: 28,
    fontWeight: '600',
    color: DISPATCHER_THEME.primary,
  },
  resultStatLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  improvementBox: {
    backgroundColor: '#f6ffed',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  improvementTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#52c41a',
    marginBottom: 4,
  },
  improvementText: {
    fontSize: 13,
    color: '#52c41a',
  },
  resultSummary: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  warningsBox: {
    backgroundColor: '#fff7e6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#fa8c16',
  },
  resultCloseBtn: {
    backgroundColor: DISPATCHER_THEME.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultCloseText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
});
