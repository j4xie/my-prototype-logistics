/**
 * AI智能排产屏幕
 *
 * 功能：
 * - 模式切换：按批次排产 / 按计划排产
 * - 日期选择
 * - 待排产批次选择（按批次模式）
 * - 生产计划选择（按计划模式）
 * - 班次配置和AI优化开关（按计划模式）
 * - AI一键智能排产
 * - 完成概率预测
 * - 产线分配建议
 * - 人员优化建议
 *
 * @version 2.0.0 - 合并AIScheduleGenerateScreen功能
 * @since 2025-12-28
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
import { DISPATCHER_THEME, ProductionPlanDTO } from '../../../types/dispatcher';
import {
  schedulingApiClient,
  ScheduleConfig,
  LineAssignment,
  WorkerSuggestion,
  AISchedulingResult,
} from '../../../services/api/schedulingApiClient';
import { productionPlanApiClient, ProductionPlan } from '../../../services/api/productionPlanApiClient';

// 排产模式类型
type ScheduleMode = 'batch' | 'plan';

// 班次类型
type ShiftType = 'day' | 'night' | 'full_day';

// 班次选项配置
const SHIFT_OPTIONS: { value: ShiftType; label: string; hours: string; icon: string }[] = [
  { value: 'day', label: '白班', hours: '08:00 - 17:00', icon: 'white-balance-sunny' },
  { value: 'night', label: '夜班', hours: '18:00 - 02:00', icon: 'weather-night' },
  { value: 'full_day', label: '全天', hours: '08:00 - 22:00', icon: 'hours-24' },
];

export default function AIScheduleScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showLoadingModal, setShowLoadingModal] = useState(false);

  // 模式切换状态 (Step 1)
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('batch');

  // 班次和AI优化配置状态 (Step 2 - 按计划模式专用)
  const [shiftType, setShiftType] = useState<ShiftType>('day');
  const [autoAssignWorkers, setAutoAssignWorkers] = useState(true);
  const [optimizeByLinUCB, setOptimizeByLinUCB] = useState(true);

  // Date state
  const [startDate, setStartDate] = useState('2025-12-28');
  const [endDate, setEndDate] = useState('2025-12-28');

  // Batch selection state (按批次模式)
  const [pendingBatches, setPendingBatches] = useState<ProductionPlanDTO[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());

  // Production plan selection state (按计划模式)
  const [productionPlans, setProductionPlans] = useState<ProductionPlan[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [loadingPlans, setLoadingPlans] = useState(false);

  // 紧急阈值配置
  const [urgentThreshold, setUrgentThreshold] = useState(0.6);

  // AI result state
  const [generatedPlanId, setGeneratedPlanId] = useState<string | null>(null);
  const [completionProbability, setCompletionProbability] = useState(0);
  const [simulationCount, setSimulationCount] = useState(10000);
  const [lineAssignments, setLineAssignments] = useState<LineAssignment[]>([]);
  const [workerSuggestions, setWorkerSuggestions] = useState<WorkerSuggestion[]>([]);
  const [efficiencyImprovement, setEfficiencyImprovement] = useState(0);
  const [improvedProbability, setImprovedProbability] = useState(0);

  // 加载紧急阈值配置
  const loadUrgentThreshold = useCallback(async () => {
    try {
      const response = await schedulingApiClient.getUrgentThresholdConfig();
      if (response.success && response.data) {
        setUrgentThreshold(response.data.threshold ?? 0.6);
      }
    } catch (error) {
      console.warn('使用默认紧急阈值 0.6:', error);
    }
  }, []);

  // 加载待排产批次（按批次模式）- 直接使用 ProductionPlanDTO
  const loadPendingBatches = useCallback(async () => {
    try {
      const response = await schedulingApiClient.getPendingBatches({ startDate, endDate });
      if (response.success && response.data) {
        // 直接使用 API 返回的 ProductionPlanDTO，紧急批次置顶
        const sortedBatches = [...response.data].sort((a, b) => {
          // 紧急批次优先
          if (a.isUrgent && !b.isUrgent) return -1;
          if (!a.isUrgent && b.isUrgent) return 1;
          // 低概率优先
          const probA = a.currentProbability ?? 1;
          const probB = b.currentProbability ?? 1;
          return probA - probB;
        });
        setPendingBatches(sortedBatches);
      }
    } catch (error) {
      console.error('Failed to load pending batches:', error);
      Alert.alert('加载失败', '无法加载待排产批次，请检查网络');
    }
  }, [startDate, endDate]);

  // 加载生产计划（按计划模式）
  const loadProductionPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      // 获取待执行的生产计划
      const response = await productionPlanApiClient.getProductionPlans({
        status: 'PENDING',
        page: 1,
        size: 50,
      });
      if (response.success && response.data) {
        const plans = response.data.content || [];
        setProductionPlans(plans);
      }
    } catch (error) {
      console.error('Failed to load production plans:', error);
      Alert.alert('加载失败', '无法加载生产计划，请检查网络');
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  // 初始化加载紧急阈值
  useEffect(() => {
    loadUrgentThreshold();
  }, [loadUrgentThreshold]);

  // 初始化加载数据
  useEffect(() => {
    if (scheduleMode === 'batch') {
      loadPendingBatches();
    } else {
      loadProductionPlans();
    }
  }, [scheduleMode, loadPendingBatches, loadProductionPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (scheduleMode === 'batch') {
        await loadPendingBatches();
      } else {
        await loadProductionPlans();
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [scheduleMode, loadPendingBatches, loadProductionPlans]);

  const toggleBatchSelection = (batchId: string) => {
    const newSelection = new Set(selectedBatches);
    if (newSelection.has(batchId)) {
      newSelection.delete(batchId);
    } else {
      newSelection.add(batchId);
    }
    setSelectedBatches(newSelection);
  };

  const selectAllBatches = () => {
    if (selectedBatches.size === pendingBatches.length) {
      setSelectedBatches(new Set());
    } else {
      setSelectedBatches(new Set(pendingBatches.map(b => b.id)));
    }
  };

  // 计划选择切换
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
    if (selectedPlanIds.size === productionPlans.length) {
      setSelectedPlanIds(new Set());
    } else {
      setSelectedPlanIds(new Set(productionPlans.map(p => p.id)));
    }
  };

  const startAISchedule = async () => {
    // 验证选择
    if (scheduleMode === 'batch' && selectedBatches.size === 0) {
      Alert.alert('提示', '请至少选择一个批次');
      return;
    }
    if (scheduleMode === 'plan' && selectedPlanIds.size === 0) {
      Alert.alert('提示', '请至少选择一个生产计划');
      return;
    }

    setShowLoadingModal(true);

    try {
      // 根据模式构建请求配置
      const config: ScheduleConfig = {
        startDate,
        endDate,
        shiftType: scheduleMode === 'plan' ? shiftType : 'day',
        autoAssignWorkers,
        enableLinUCB: optimizeByLinUCB,
      };

      if (scheduleMode === 'batch') {
        // 按批次模式 - 使用批次ID
        config.batchIds = Array.from(selectedBatches);
      } else {
        // 按计划模式 - 使用生产计划ID
        config.planIds = Array.from(selectedPlanIds);
      }

      // 调用 AI 排产 API
      const result = await schedulingApiClient.generateSchedule(config);

      if (result.success && result.data) {
        // 解析 AI 结果
        const scheduleResult = result.data;

        // 更新完成概率
        if (scheduleResult.completionProbability !== undefined) {
          setCompletionProbability(Math.round(scheduleResult.completionProbability * 100));
        }
        if (scheduleResult.simulationRuns !== undefined) {
          setSimulationCount(scheduleResult.simulationRuns);
        }

        // 更新产线分配
        if (scheduleResult.lineAssignments && scheduleResult.lineAssignments.length > 0) {
          setLineAssignments(scheduleResult.lineAssignments.map((la: any) => ({
            lineId: la.lineId || la.productionLineId,
            lineName: la.lineName || la.productionLineName || `产线 ${la.lineId}`,
            load: la.load || la.utilizationRate || 70,
            loadLevel: (la.load || la.utilizationRate || 70) > 85 ? 'high' : (la.load || la.utilizationRate || 70) > 70 ? 'medium' : 'low',
            batches: la.batches || la.assignedBatches || [],
          })));
        }

        // 更新工人优化建议
        if (scheduleResult.workerSuggestions && scheduleResult.workerSuggestions.length > 0) {
          setWorkerSuggestions(scheduleResult.workerSuggestions);
        }

        // 更新效率提升
        if (scheduleResult.efficiencyImprovement !== undefined) {
          setEfficiencyImprovement(Math.round(scheduleResult.efficiencyImprovement * 100));
        }
        if (scheduleResult.improvedProbability !== undefined) {
          setImprovedProbability(Math.round(scheduleResult.improvedProbability * 100));
        }

        // 保存生成的计划ID用于后续确认
        if (scheduleResult.plan?.id) {
          setGeneratedPlanId(scheduleResult.plan.id);
        }

        setShowResult(true);
      } else {
        throw new Error(result.message || 'AI排产失败');
      }
    } catch (error) {
      console.error('AI scheduling failed:', error);
      Alert.alert('错误', 'AI排产失败，请稍后重试');
    } finally {
      setShowLoadingModal(false);
    }
  };

  const applySchedule = async () => {
    try {
      setLoading(true);

      // 根据模式确定要确认的计划
      if (generatedPlanId) {
        // 确认 AI 生成的调度计划
        const response = await schedulingApiClient.confirmPlan(generatedPlanId);
        if (!response.success) {
          throw new Error(response.message || '确认排产计划失败');
        }
      } else if (scheduleMode === 'plan' && selectedPlanIds.size > 0) {
        // 按计划模式：批量确认选中的生产计划
        const confirmPromises = Array.from(selectedPlanIds).map(planId =>
          schedulingApiClient.confirmPlan(planId)
        );
        const results = await Promise.all(confirmPromises);
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
          throw new Error(`${failed.length} 个计划确认失败`);
        }
      } else {
        throw new Error('没有可确认的排产计划');
      }

      const count = scheduleMode === 'batch' ? selectedBatches.size : selectedPlanIds.size;
      Alert.alert(
        '排产方案已应用',
        `已确认 ${count} 个生产计划，人员调动申请已提交审批。`,
        [
          {
            text: '确定',
            onPress: () => navigation.getParent()?.navigate('PlanTab', { screen: 'PlanList' })
          }
        ]
      );
    } catch (error) {
      console.error('Apply schedule failed:', error);
      const errorMessage = error instanceof Error ? error.message : '应用排产方案失败';
      Alert.alert('错误', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    // 只隐藏AI分析结果，回到开始分析前的界面
    // 保留已选择的批次，用户可以重新选择或调整
    setShowResult(false);

    // 注意：不清空selectedBatches，不重置AI结果
    // 这样用户可以看到之前的选择，决定是否重新分析
  };

  const getLoadColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return { bg: '#f6ffed', text: '#52c41a' };
      case 'medium': return { bg: '#fff7e6', text: '#fa8c16' };
      case 'high': return { bg: '#fff1f0', text: '#ff4d4f' };
    }
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
          <MaterialCommunityIcons name="robot" size={32} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>AI 智能排产</Text>
        <Text style={styles.headerSubtitle}>基于 Monte Carlo + OR-Tools + LLM</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Switching Tab (Step 1) */}
        <View style={styles.modeTabContainer}>
          <TouchableOpacity
            style={[styles.modeTab, scheduleMode === 'batch' && styles.modeTabActive]}
            onPress={() => setScheduleMode('batch')}
          >
            <MaterialCommunityIcons
              name="package-variant"
              size={18}
              color={scheduleMode === 'batch' ? '#fff' : '#666'}
            />
            <Text style={[styles.modeTabText, scheduleMode === 'batch' && styles.modeTabTextActive]}>
              按批次排产
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, scheduleMode === 'plan' && styles.modeTabActive]}
            onPress={() => setScheduleMode('plan')}
          >
            <MaterialCommunityIcons
              name="clipboard-list"
              size={18}
              color={scheduleMode === 'plan' ? '#fff' : '#666'}
            />
            <Text style={[styles.modeTabText, scheduleMode === 'plan' && styles.modeTabTextActive]}>
              按计划排产
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Selection Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="calendar" size={20} color="#333" />
              <Text style={styles.cardTitle}>排产日期</Text>
            </View>
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>开始日期</Text>
              <TouchableOpacity style={styles.dateInput}>
                <Text style={styles.dateInputText}>{startDate}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>结束日期</Text>
              <TouchableOpacity style={styles.dateInput}>
                <Text style={styles.dateInputText}>{endDate}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Schedule Config Card - 仅按计划模式显示 */}
        {scheduleMode === 'plan' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="cog" size={20} color="#333" />
                <Text style={styles.cardTitle}>排程配置</Text>
              </View>
            </View>

            {/* 班次类型选择 */}
            <Text style={styles.configLabel}>班次类型</Text>
            <View style={styles.shiftOptionsRow}>
              {SHIFT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.shiftOption,
                    shiftType === option.value && styles.shiftOptionActive,
                  ]}
                  onPress={() => setShiftType(option.value)}
                >
                  <MaterialCommunityIcons
                    name={option.icon as any}
                    size={20}
                    color={shiftType === option.value ? '#fff' : '#666'}
                  />
                  <Text
                    style={[
                      styles.shiftOptionLabel,
                      shiftType === option.value && styles.shiftOptionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.shiftOptionHours,
                      shiftType === option.value && styles.shiftOptionHoursActive,
                    ]}
                  >
                    {option.hours}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* AI 优化开关 */}
            <View style={styles.switchRow}>
              <View style={styles.switchItem}>
                <Text style={styles.switchLabel}>自动分配工人</Text>
                <TouchableOpacity
                  style={[styles.switchTrack, autoAssignWorkers && styles.switchTrackActive]}
                  onPress={() => setAutoAssignWorkers(!autoAssignWorkers)}
                >
                  <View style={[styles.switchThumb, autoAssignWorkers && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
              <View style={styles.switchItem}>
                <Text style={styles.switchLabel}>LinUCB 优化</Text>
                <TouchableOpacity
                  style={[styles.switchTrack, optimizeByLinUCB && styles.switchTrackActive]}
                  onPress={() => setOptimizeByLinUCB(!optimizeByLinUCB)}
                >
                  <View style={[styles.switchThumb, optimizeByLinUCB && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Conditional Selection List */}
        {scheduleMode === 'batch' ? (
          /* Pending Batches Card - 按批次模式 */
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="package-variant" size={20} color="#333" />
                <Text style={styles.cardTitle}>待排产批次</Text>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>{pendingBatches.length} 个</Text>
                </View>
              </View>
              <TouchableOpacity onPress={selectAllBatches}>
                <Text style={styles.selectAllText}>
                  {selectedBatches.size === pendingBatches.length ? '取消全选' : '全选'}
                </Text>
              </TouchableOpacity>
            </View>

            {pendingBatches.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="package-variant-closed" size={48} color="#ccc" />
                <Text style={styles.emptyText}>暂无待排产批次</Text>
                <Text style={styles.emptySubtext}>请检查日期范围或刷新页面</Text>
              </View>
            ) : (
              [...pendingBatches]
                .sort((a, b) => {
                  if (a.isUrgent && !b.isUrgent) return -1;
                  if (!a.isUrgent && b.isUrgent) return 1;
                  return 0;
                })
                .map((batch) => (
                  <TouchableOpacity
                    key={batch.id}
                    style={styles.batchItem}
                    onPress={() => toggleBatchSelection(batch.id)}
                  >
                    <View style={[
                      styles.batchCheckbox,
                      selectedBatches.has(batch.id) && styles.batchCheckboxChecked
                    ]}>
                      {selectedBatches.has(batch.id) && (
                        <MaterialCommunityIcons name="check" size={14} color="#fff" />
                      )}
                    </View>
                    <View style={styles.batchInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.batchName}>
                          {batch.productTypeName || '未命名'} {batch.plannedQuantity}kg
                        </Text>
                        {batch.isUrgent && (
                          <View style={styles.urgentBadge}>
                            <MaterialCommunityIcons name="alert" size={12} color="#fff" />
                            <Text style={styles.urgentBadgeText}>紧急</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.batchMeta}>
                        计划号: {batch.planNumber} | 交期: {batch.expectedCompletionDate}
                        {batch.currentProbability !== undefined && (
                          <Text style={[
                            styles.urgentProbability,
                            { color: batch.currentProbability < urgentThreshold ? '#ff4d4f' : '#52c41a' }
                          ]}>
                            {' '}| 完成概率: {Math.round(batch.currentProbability * 100)}%
                          </Text>
                        )}
                      </Text>
                    </View>
                    <View style={[
                      styles.priorityBadge,
                      batch.isUrgent ? styles.priorityHigh : styles.priorityNormal
                    ]}>
                      <Text style={[
                        styles.priorityText,
                        batch.isUrgent ? styles.priorityHighText : styles.priorityNormalText
                      ]}>
                        {batch.isUrgent ? '紧急' : '普通'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
            )}
          </View>
        ) : (
          /* Production Plans Card - 按计划模式 */
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="clipboard-list" size={20} color="#333" />
                <Text style={styles.cardTitle}>选择生产计划</Text>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>{productionPlans.length} 个</Text>
                </View>
              </View>
              <TouchableOpacity onPress={selectAllPlans}>
                <Text style={styles.selectAllText}>
                  {selectedPlanIds.size === productionPlans.length ? '取消全选' : '全选'}
                </Text>
              </TouchableOpacity>
            </View>

            {loadingPlans ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={DISPATCHER_THEME.primary} />
                <Text style={styles.loadingStateText}>加载中...</Text>
              </View>
            ) : productionPlans.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="clipboard-text-off" size={48} color="#ccc" />
                <Text style={styles.emptyText}>暂无待执行的生产计划</Text>
                <Text style={styles.emptySubtext}>请先创建生产计划</Text>
              </View>
            ) : (
              productionPlans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={styles.batchItem}
                  onPress={() => togglePlanSelection(plan.id)}
                >
                  <View style={[
                    styles.batchCheckbox,
                    selectedPlanIds.has(plan.id) && styles.batchCheckboxChecked
                  ]}>
                    {selectedPlanIds.has(plan.id) && (
                      <MaterialCommunityIcons name="check" size={14} color="#fff" />
                    )}
                  </View>
                  <View style={styles.batchInfo}>
                    <Text style={styles.batchName}>
                      {plan.productTypeName || plan.productName || '未命名产品'} {plan.plannedQuantity}{plan.productUnit || 'kg'}
                    </Text>
                    <Text style={styles.batchMeta}>
                      计划号: {plan.planNumber} | 客户: {plan.customerName || '-'}
                    </Text>
                  </View>
                  <View style={[
                    styles.priorityBadge,
                    (plan.priority ?? 0) >= 8 ? styles.priorityHigh : styles.priorityNormal
                  ]}>
                    <Text style={[
                      styles.priorityText,
                      (plan.priority ?? 0) >= 8 ? styles.priorityHighText : styles.priorityNormalText
                    ]}>
                      {(plan.priority ?? 0) >= 8 ? '紧急' : '普通'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* AI Schedule Button */}
        {!showResult && (
          <TouchableOpacity onPress={startAISchedule}>
            <LinearGradient
              colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.aiButton}
            >
              <MaterialCommunityIcons name="robot" size={24} color="#fff" />
              <Text style={styles.aiButtonText}>
                {scheduleMode === 'batch'
                  ? `AI 排产 (${selectedBatches.size} 批次)`
                  : `AI 排产 (${selectedPlanIds.size} 计划)`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* AI Results */}
        {showResult && (
          <>
            {/* Completion Probability */}
            <View style={[styles.card, { marginTop: 16 }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="chart-line" size={20} color="#333" />
                  <Text style={styles.cardTitle}>完成概率预测</Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>Monte Carlo</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('AICompletionProb')}>
                  <Text style={styles.detailLink}>详情 &gt;</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.probabilityGauge}>
                <View style={styles.gaugeCircle}>
                  <View style={styles.gaugeInner}>
                    <Text style={styles.gaugeValue}>{completionProbability}%</Text>
                    <Text style={styles.gaugeLabel}>按时完成</Text>
                  </View>
                </View>
                <Text style={styles.probabilityDesc}>
                  基于 <Text style={styles.probabilityHighlight}>{simulationCount.toLocaleString()} 次模拟</Text>，
                  预计按时完成概率 <Text style={styles.probabilityHighlight}>{completionProbability}%</Text>
                </Text>
              </View>
            </View>

            {/* Line Assignment Suggestions */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="factory" size={20} color="#333" />
                  <Text style={styles.cardTitle}>产线分配建议</Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>OR-Tools</Text>
                  </View>
                </View>
              </View>

              {lineAssignments.map((line) => {
                const loadColor = getLoadColor(line.loadLevel);
                return (
                  <View key={line.lineId} style={styles.lineAssignment}>
                    <View style={styles.lineHeader}>
                      <Text style={styles.lineName}>{line.lineName}</Text>
                      <View style={[styles.lineLoad, { backgroundColor: loadColor.bg }]}>
                        <Text style={[styles.lineLoadText, { color: loadColor.text }]}>
                          负荷 {line.load}%
                        </Text>
                      </View>
                    </View>
                    <View style={styles.lineBatches}>
                      {line.batches.map((batch, index) => (
                        <View key={index} style={styles.lineBatchTag}>
                          <Text style={styles.lineBatchTagText}>{batch}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Worker Optimization Suggestions */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="account-group" size={20} color="#333" />
                  <Text style={styles.cardTitle}>人员优化建议</Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>LinUCB</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('AIWorkerOptimize')}>
                  <Text style={styles.detailLink}>详情 &gt;</Text>
                </TouchableOpacity>
              </View>

              {workerSuggestions.map((worker) => (
                <View key={worker.workerId} style={styles.workerSuggestion}>
                  <View style={styles.workerLeft}>
                    <LinearGradient
                      colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                      style={styles.workerAvatar}
                    >
                      <Text style={styles.workerAvatarText}>
                        {worker.workerName.charAt(0)}
                      </Text>
                    </LinearGradient>
                    <View style={styles.workerInfo}>
                      <Text style={styles.workerName}>{worker.workerName}</Text>
                      <Text style={styles.workerMeta}>{worker.currentPosition} | {worker.skill}</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={20} color={DISPATCHER_THEME.primary} />
                  <Text style={styles.workerTarget}>{worker.targetLine}</Text>
                </View>
              ))}

              <View style={styles.aiTip}>
                <MaterialCommunityIcons name="lightbulb-on" size={16} color="#52c41a" />
                <Text style={styles.aiTipText}>
                  AI 建议：调整后预计效率提升 {efficiencyImprovement}%，完成概率提升至 {improvedProbability}%
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.outlineButton, { flex: 1 }]}
                onPress={handleReset}
              >
                <MaterialCommunityIcons name="refresh" size={18} color={DISPATCHER_THEME.primary} />
                <Text style={[styles.outlineButtonText, { marginLeft: 4 }]}>重新分析</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.solidButton, { flex: 1, marginLeft: 12 }]}
                onPress={applySchedule}
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
                    <Text style={styles.solidButtonText}>应用排产方案</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Loading Modal */}
      <Modal
        visible={showLoadingModal}
        transparent
        animationType="fade"
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
            <Text style={styles.loadingText}>AI 正在分析...</Text>
            <Text style={styles.loadingSubtext}>Monte Carlo 模拟中 (10,000次)</Text>
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
  content: {
    flex: 1,
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
    marginBottom: 12,
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
  selectAllText: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
  },
  dateInputText: {
    fontSize: 14,
    color: '#333',
  },
  batchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  batchCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d9d9d9',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchCheckboxChecked: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  batchInfo: {
    flex: 1,
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
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityHigh: {
    backgroundColor: '#fff1f0',
  },
  priorityNormal: {
    backgroundColor: '#f5f5f5',
  },
  priorityText: {
    fontSize: 11,
  },
  priorityHighText: {
    color: '#ff4d4f',
  },
  priorityNormalText: {
    color: '#999',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4d4f',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
    gap: 2,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fff',
  },
  urgentProbability: {
    color: '#ff4d4f',
    fontWeight: '500',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  aiButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  detailLink: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  probabilityGauge: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'linear-gradient(135deg, #f9f5ff 0%, #fff 100%)',
    borderRadius: 12,
  },
  gaugeCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: '#52c41a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gaugeInner: {
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 28,
    fontWeight: '600',
    color: '#52c41a',
  },
  gaugeLabel: {
    fontSize: 12,
    color: '#999',
  },
  probabilityDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  probabilityHighlight: {
    color: DISPATCHER_THEME.primary,
    fontWeight: '600',
  },
  lineAssignment: {
    backgroundColor: '#f9f5ff',
    borderWidth: 1,
    borderColor: '#d3adf7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lineName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  lineLoad: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lineLoadText: {
    fontSize: 12,
  },
  lineBatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lineBatchTag: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  lineBatchTagText: {
    fontSize: 12,
    color: '#666',
  },
  workerSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  workerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  workerMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  workerTarget: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginLeft: 8,
  },
  aiTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6ffed',
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
    gap: 6,
  },
  aiTipText: {
    fontSize: 12,
    color: '#52c41a',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  outlineButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: DISPATCHER_THEME.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  outlineButtonText: {
    fontSize: 14,
    color: DISPATCHER_THEME.primary,
  },
  solidButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  solidButtonGradient: {
    padding: 12,
    alignItems: 'center',
  },
  solidButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
    padding: 32,
    alignItems: 'center',
    maxWidth: 280,
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#999',
  },
  // Mode Tab styles
  modeTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  modeTabText: {
    fontSize: 14,
    color: '#666',
  },
  modeTabTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  // Config Card styles
  configLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    marginTop: 4,
  },
  shiftOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  shiftOption: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  shiftOptionActive: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  shiftOptionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginTop: 4,
  },
  shiftOptionLabelActive: {
    color: '#fff',
  },
  shiftOptionHours: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  shiftOptionHoursActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  // Switch styles
  switchRow: {
    flexDirection: 'row',
    gap: 16,
  },
  switchItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
  },
  switchLabel: {
    fontSize: 13,
    color: '#333',
  },
  switchTrack: {
    width: 44,
    height: 24,
    backgroundColor: '#d9d9d9',
    borderRadius: 12,
    padding: 2,
  },
  switchTrackActive: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  switchThumb: {
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  // Empty/Loading state styles
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 4,
  },
  loadingState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  loadingStateText: {
    fontSize: 14,
    color: '#999',
  },
});
