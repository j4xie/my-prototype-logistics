/**
 * AI 自动生成排程屏幕
 *
 * 功能：
 * - 选择生产计划自动生成排程
 * - 配置班次类型和工人可用性
 * - 预览生成的排程
 * - 支持调整后保存
 *
 * 与 AIScheduleScreen 区别：
 * - AIScheduleScreen: 交互式 AI 调度中心，选择批次后 AI 排产
 * - AIScheduleGenerateScreen: 从生产计划批量自动生成排程
 *
 * @version 1.0.0
 * @since 2025-12-29
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DISPATCHER_THEME, ProductionPlan, LineSchedule } from '../../../types/dispatcher';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import { productionPlanApiClient } from '../../../services/api/productionPlanApiClient';

// 班次类型
type ShiftType = 'day' | 'night' | 'full_day';

const SHIFT_OPTIONS: { value: ShiftType; label: string; hours: string; icon: string }[] = [
  { value: 'day', label: '白班', hours: '08:00 - 17:00', icon: 'white-balance-sunny' },
  { value: 'night', label: '夜班', hours: '18:00 - 02:00', icon: 'weather-night' },
  { value: 'full_day', label: '全天', hours: '08:00 - 22:00', icon: 'hours-24' },
];

// 生成的排程接口
interface GeneratedSchedule {
  planId: string;
  planNumber: string;
  productName: string;
  lineName: string;
  lineId: string;
  workerCount: number;
  startTime: string;
  endTime: string;
  estimatedEfficiency: number;
  completionProbability: number;
}

export default function AIScheduleGenerateScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGenerating, setShowGenerating] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // 配置参数
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0] ?? '';
  });
  const [shiftType, setShiftType] = useState<ShiftType>('day');
  const [autoAssignWorkers, setAutoAssignWorkers] = useState(true);
  const [optimizeByLinUCB, setOptimizeByLinUCB] = useState(true);

  // 数据
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [generatedSchedules, setGeneratedSchedules] = useState<GeneratedSchedule[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 统计数据
  const [totalWorkers, setTotalWorkers] = useState(0);
  const [avgEfficiency, setAvgEfficiency] = useState(0);
  const [avgProbability, setAvgProbability] = useState(0);

  const loadPlans = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    setError(null);

    try {
      // 加载待排产的生产计划 (状态为 pending 或 confirmed)
      const response = await productionPlanApiClient.getProductionPlans({
        status: 'PENDING',
        page: 1,
        size: 50,
      });

      if (response.success && response.data) {
        // response.data 是 PagedResponse<ProductionPlan>
        const planList = response.data.content ?? [];
        // 兼容两种类型，将 productionPlanApiClient 的结果转换为 dispatcher 的 ProductionPlan
        setPlans(planList as unknown as ProductionPlan[]);
        // 默认不选中任何计划，让用户手动选择
        setSelectedPlanIds(new Set());
      } else {
        setError('加载生产计划失败');
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
      setError('加载生产计划失败，请稍后重试');
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const onRefresh = useCallback(() => {
    loadPlans(true);
  }, [loadPlans]);

  const togglePlanSelection = (planId: string) => {
    const newSelection = new Set(selectedPlanIds);
    if (newSelection.has(planId)) {
      newSelection.delete(planId);
    } else {
      newSelection.add(planId);
    }
    setSelectedPlanIds(newSelection);
  };

  const selectAllPlans = () => {
    if (selectedPlanIds.size === plans.length) {
      setSelectedPlanIds(new Set());
    } else {
      setSelectedPlanIds(new Set(plans.map(p => p.id)));
    }
  };

  const generateSchedule = async () => {
    if (selectedPlanIds.size === 0) {
      Alert.alert('提示', '请至少选择一个生产计划');
      return;
    }

    setShowGenerating(true);

    try {
      // 调用 AI 生成排程 API
      const response = await schedulingApiClient.generateSchedule({
        planDate: scheduleDate,
        shiftType,
        planIds: Array.from(selectedPlanIds),
        autoAssignWorkers,
        enableLinUCB: optimizeByLinUCB,
      });

      if (response.success && response.data) {
        // 转换 API 响应为组件所需格式
        // AISchedulingResult 包含: plan, completionProbability, lineAssignments, workerSuggestions 等
        const result = response.data;
        const plan = result.plan;

        // 从 lineAssignments 构建每条产线的排程详情，或使用主 plan 作为单条记录
        const schedules: GeneratedSchedule[] = (result.lineAssignments && result.lineAssignments.length > 0)
          ? result.lineAssignments.map((line) => ({
              planId: plan.id,
              planNumber: plan.batchNumber ?? '-',
              productName: plan.productTypeName ?? '-',
              lineName: line.lineName ?? '默认产线',
              lineId: line.lineId ?? '',
              workerCount: result.workerSuggestions?.filter(w => w.targetLine === line.lineName).length ?? 0,
              startTime: plan.plannedStartTime ? new Date(plan.plannedStartTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-',
              endTime: plan.plannedEndTime ? new Date(plan.plannedEndTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-',
              estimatedEfficiency: Math.round(100 - (line.load || 0)),
              completionProbability: result.completionProbability ?? 80,
            }))
          : [{
              planId: plan.id,
              planNumber: plan.batchNumber ?? '-',
              productName: plan.productTypeName ?? '-',
              lineName: '默认产线',
              lineId: '',
              workerCount: plan.totalWorkers ?? 0,
              startTime: plan.plannedStartTime ? new Date(plan.plannedStartTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-',
              endTime: plan.plannedEndTime ? new Date(plan.plannedEndTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-',
              estimatedEfficiency: result.efficiencyImprovement ?? 85,
              completionProbability: result.completionProbability ?? 80,
            }];

        setGeneratedSchedules(schedules);

        // 计算统计
        if (schedules.length > 0) {
          const workers = schedules.reduce((sum, s) => sum + s.workerCount, 0);
          const efficiency = schedules.reduce((sum, s) => sum + s.estimatedEfficiency, 0) / schedules.length;
          const probability = schedules.reduce((sum, s) => sum + s.completionProbability, 0) / schedules.length;

          setTotalWorkers(workers);
          setAvgEfficiency(Math.round(efficiency));
          setAvgProbability(Math.round(probability));
        }

        setShowResult(true);
      } else {
        Alert.alert('错误', response.message ?? '排程生成失败');
      }
    } catch (err) {
      console.error('Generate schedule failed:', err);
      Alert.alert('错误', '排程生成失败，请稍后重试');
    } finally {
      setShowGenerating(false);
    }
  };

  const confirmSchedule = async () => {
    try {
      setLoading(true);

      // 确认生成的排程 - 调用 API 保存
      // 由于 generate API 已经创建了排程，这里主要是确认/保存状态
      const planIds = generatedSchedules.map(s => s.planId);

      // 批量确认这些计划的排程
      for (const planId of planIds) {
        const response = await schedulingApiClient.confirmPlan(planId);
        if (!response.success) {
          throw new Error(response.message ?? '确认排程失败');
        }
      }

      Alert.alert(
        '排程已保存',
        `成功创建 ${generatedSchedules.length} 个产线排程`,
        [{ text: '确定', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      console.error('Confirm schedule failed:', err);
      Alert.alert('错误', '保存排程失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return { bg: '#fff1f0', text: '#ff4d4f', label: '高' };
    if (priority >= 5) return { bg: '#fff7e6', text: '#fa8c16', label: '中' };
    return { bg: '#f6ffed', text: '#52c41a', label: '低' };
  };

  const getSourceLabel = (plan: ProductionPlan) => {
    switch (plan.sourceType) {
      case 'customer_order':
        return { label: '客户订单', color: '#1890ff' };
      case 'ai_forecast':
        return { label: 'AI预测', color: '#722ed1' };
      case 'urgent_insert':
        return { label: '紧急插单', color: '#ff4d4f' };
      case 'safety_stock':
        return { label: '安全库存', color: '#52c41a' };
      default:
        return { label: '手动', color: '#999' };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
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

        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="auto-fix" size={28} color="#fff" />
          <Text style={styles.headerTitle}>AI 自动生成排程</Text>
        </View>
        <Text style={styles.headerSubtitle}>基于生产计划智能分配产线和人员</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {initialLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
            <Text style={styles.loadingText}>加载生产计划...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ff4d4f" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadPlans()}>
              <Text style={styles.retryButtonText}>重新加载</Text>
            </TouchableOpacity>
          </View>
        ) : !showResult ? (
          <>
            {/* 配置区域 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>排程配置</Text>

              {/* 日期选择 */}
              <View style={styles.configRow}>
                <Text style={styles.configLabel}>排程日期</Text>
                <TouchableOpacity style={styles.dateInput}>
                  <MaterialCommunityIcons name="calendar" size={18} color={DISPATCHER_THEME.primary} />
                  <Text style={styles.dateInputText}>{scheduleDate}</Text>
                </TouchableOpacity>
              </View>

              {/* 班次选择 */}
              <View style={styles.configSection}>
                <Text style={styles.configLabel}>班次类型</Text>
                <View style={styles.shiftGrid}>
                  {SHIFT_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.shiftItem,
                        shiftType === option.value && styles.shiftItemActive,
                      ]}
                      onPress={() => setShiftType(option.value)}
                    >
                      <MaterialCommunityIcons
                        name={option.icon as any}
                        size={22}
                        color={shiftType === option.value ? '#fff' : DISPATCHER_THEME.primary}
                      />
                      <Text
                        style={[
                          styles.shiftLabel,
                          shiftType === option.value && styles.shiftLabelActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={[
                          styles.shiftHours,
                          shiftType === option.value && styles.shiftHoursActive,
                        ]}
                      >
                        {option.hours}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* AI 选项 */}
              <View style={styles.configSection}>
                <Text style={styles.configLabel}>AI 优化选项</Text>

                <TouchableOpacity
                  style={styles.switchRow}
                  onPress={() => setAutoAssignWorkers(!autoAssignWorkers)}
                >
                  <View>
                    <Text style={styles.switchLabel}>自动分配工人</Text>
                    <Text style={styles.switchDesc}>基于技能和可用性自动分配</Text>
                  </View>
                  <View style={[styles.switch, autoAssignWorkers && styles.switchActive]}>
                    <View style={[styles.switchThumb, autoAssignWorkers && styles.switchThumbActive]} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.switchRow}
                  onPress={() => setOptimizeByLinUCB(!optimizeByLinUCB)}
                >
                  <View>
                    <Text style={styles.switchLabel}>LinUCB 人员优化</Text>
                    <Text style={styles.switchDesc}>使用强化学习优化工人分配</Text>
                  </View>
                  <View style={[styles.switch, optimizeByLinUCB && styles.switchActive]}>
                    <View style={[styles.switchThumb, optimizeByLinUCB && styles.switchThumbActive]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* 生产计划选择 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>选择生产计划</Text>
                <TouchableOpacity onPress={selectAllPlans}>
                  <Text style={styles.selectAllText}>
                    {selectedPlanIds.size === plans.length ? '取消全选' : '全选'}
                  </Text>
                </TouchableOpacity>
              </View>

              {plans.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#d9d9d9" />
                  <Text style={styles.emptyStateText}>暂无待排产的生产计划</Text>
                  <Text style={styles.emptyStateSubtext}>请先创建生产计划</Text>
                </View>
              ) : plans.map((plan) => {
                const priorityStyle = getPriorityColor(plan.priority);
                const sourceStyle = getSourceLabel(plan);
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={styles.planItem}
                    onPress={() => togglePlanSelection(plan.id)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        selectedPlanIds.has(plan.id) && styles.checkboxChecked,
                      ]}
                    >
                      {selectedPlanIds.has(plan.id) && (
                        <MaterialCommunityIcons name="check" size={14} color="#fff" />
                      )}
                    </View>

                    <View style={styles.planInfo}>
                      <View style={styles.planHeader}>
                        <Text style={styles.planNumber}>{plan.planNumber}</Text>
                        <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg }]}>
                          <Text style={[styles.priorityText, { color: priorityStyle.text }]}>
                            {priorityStyle.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.planProduct}>
                        {plan.productTypeName} · {plan.plannedQuantity}{plan.unit}
                      </Text>
                      <View style={styles.planMeta}>
                        <View style={styles.sourceTag}>
                          <Text style={[styles.sourceText, { color: sourceStyle.color }]}>
                            {sourceStyle.label}
                          </Text>
                        </View>
                        {plan.crValue && (
                          <Text style={styles.crText}>CR: {plan.crValue}</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 生成按钮 */}
            <TouchableOpacity onPress={generateSchedule}>
              <LinearGradient
                colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateButton}
              >
                <MaterialCommunityIcons name="auto-fix" size={22} color="#fff" />
                <Text style={styles.generateButtonText}>
                  生成排程 ({selectedPlanIds.size} 个计划)
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* 统计概览 */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{generatedSchedules.length}</Text>
                <Text style={styles.statLabel}>排程数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalWorkers}</Text>
                <Text style={styles.statLabel}>所需工人</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#52c41a' }]}>{avgEfficiency}%</Text>
                <Text style={styles.statLabel}>预计效率</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: DISPATCHER_THEME.primary }]}>{avgProbability}%</Text>
                <Text style={styles.statLabel}>完成概率</Text>
              </View>
            </View>

            {/* 生成结果 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>排程预览</Text>

              {generatedSchedules.map((schedule, index) => (
                <View key={schedule.planId} style={styles.scheduleItem}>
                  <View style={styles.scheduleHeader}>
                    <Text style={styles.scheduleNumber}>{schedule.planNumber}</Text>
                    <View style={styles.scheduleTime}>
                      <MaterialCommunityIcons name="clock-outline" size={14} color="#666" />
                      <Text style={styles.scheduleTimeText}>
                        {schedule.startTime} - {schedule.endTime}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.scheduleProduct}>{schedule.productName}</Text>

                  <View style={styles.scheduleDetails}>
                    <View style={styles.scheduleDetail}>
                      <MaterialCommunityIcons name="factory" size={14} color="#666" />
                      <Text style={styles.scheduleDetailText}>{schedule.lineName}</Text>
                    </View>
                    <View style={styles.scheduleDetail}>
                      <MaterialCommunityIcons name="account-group" size={14} color="#666" />
                      <Text style={styles.scheduleDetailText}>{schedule.workerCount} 人</Text>
                    </View>
                    <View style={styles.scheduleDetail}>
                      <MaterialCommunityIcons name="speedometer" size={14} color="#52c41a" />
                      <Text style={[styles.scheduleDetailText, { color: '#52c41a' }]}>
                        {schedule.estimatedEfficiency}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.probabilityBar}>
                    <View
                      style={[
                        styles.probabilityFill,
                        { width: `${schedule.completionProbability}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.probabilityText}>
                    完成概率: {schedule.completionProbability}%
                  </Text>
                </View>
              ))}
            </View>

            {/* 操作按钮 */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => setShowResult(false)}
              >
                <Text style={styles.outlineButtonText}>重新生成</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.solidButton}
                onPress={confirmSchedule}
                disabled={loading}
              >
                <LinearGradient
                  colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.solidButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.solidButtonText}>确认并保存</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 生成中弹窗 */}
      <Modal visible={showGenerating} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
            <Text style={styles.loadingTitle}>AI 正在生成排程...</Text>
            <View style={styles.loadingSteps}>
              <View style={styles.loadingStep}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#52c41a" />
                <Text style={styles.loadingStepText}>分析生产计划</Text>
              </View>
              <View style={styles.loadingStep}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#52c41a" />
                <Text style={styles.loadingStepText}>匹配产线资源</Text>
              </View>
              <View style={styles.loadingStep}>
                <ActivityIndicator size="small" color={DISPATCHER_THEME.primary} />
                <Text style={styles.loadingStepText}>优化人员分配 (LinUCB)</Text>
              </View>
              <View style={styles.loadingStep}>
                <MaterialCommunityIcons name="circle-outline" size={16} color="#d9d9d9" />
                <Text style={[styles.loadingStepText, { color: '#999' }]}>计算完成概率</Text>
              </View>
            </View>
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
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    position: 'absolute',
    left: 8,
    top: 12,
    padding: 4,
    zIndex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  configLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  configSection: {
    marginBottom: 16,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dateInputText: {
    fontSize: 14,
    color: '#333',
  },
  shiftGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  shiftItem: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  shiftItemActive: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  shiftLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 6,
  },
  shiftLabelActive: {
    color: '#fff',
  },
  shiftHours: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  shiftHoursActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  switchDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d9d9d9',
    justifyContent: 'center',
    padding: 2,
  },
  switchActive: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  selectAllText: {
    fontSize: 13,
    color: DISPATCHER_THEME.primary,
  },
  planItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d9d9d9',
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
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
  planNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  planProduct: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  planMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sourceTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceText: {
    fontSize: 11,
  },
  crText: {
    fontSize: 11,
    color: '#999',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  scheduleItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  scheduleNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  scheduleTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleTimeText: {
    fontSize: 12,
    color: '#666',
  },
  scheduleProduct: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  scheduleDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  scheduleDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleDetailText: {
    fontSize: 12,
    color: '#666',
  },
  probabilityBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 4,
  },
  probabilityFill: {
    height: '100%',
    backgroundColor: DISPATCHER_THEME.primary,
    borderRadius: 2,
  },
  probabilityText: {
    fontSize: 11,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  outlineButton: {
    flex: 1,
    padding: 14,
    borderWidth: 1.5,
    borderColor: DISPATCHER_THEME.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  outlineButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: DISPATCHER_THEME.primary,
  },
  solidButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  solidButtonGradient: {
    padding: 14,
    alignItems: 'center',
  },
  solidButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: 280,
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 20,
  },
  loadingSteps: {
    width: '100%',
    gap: 12,
  },
  loadingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingStepText: {
    fontSize: 13,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#ff4d4f',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: DISPATCHER_THEME.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  emptyStateSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#bbb',
  },
});
