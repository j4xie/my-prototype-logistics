/**
 * 生产计划列表屏幕
 *
 * 功能：
 * - 多维度筛选（状态、车间、日期、来源）
 * - 搜索计划编号/产品名称
 * - 快捷入口（甘特图、紧急插单、混批排产、资源总览）
 * - 计划卡片（客户订单、混批、AI预测、安全库存来源）
 *
 * @version 1.0.0
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
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { DISPATCHER_THEME, ProductionPlanDTO } from '../../../types/dispatcher';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';

// Local extended type for mock data display
type PlanSourceType = 'customer_order' | 'ai_forecast' | 'safety_stock' | 'manual' | 'urgent_insert' | 'mixed_batch';

interface RelatedOrder {
  orderId: string;
  customerName: string;
  quantity: number;
}

interface DisplayPlan {
  id: string;
  planNumber: string;
  productName: string;
  quantity: number;
  unit: string;
  workshopName: string;
  supervisorName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress: number;
  sourceType: PlanSourceType;
  customerName?: string;
  crValue?: number;
  crLevel?: 'urgent' | 'tight' | 'sufficient';
  deadline?: string;
  tags?: string[];
  isMixedBatch?: boolean;
  mergedOrderCount?: number;
  relatedOrders?: RelatedOrder[];
  forecastReason?: string;
  aiConfidence?: number;
  season?: string;
  stockLevel?: number;
  // 紧急状态监控字段
  isUrgent?: boolean;
  currentProbability?: number;
  // 审批相关字段
  requiresApproval?: boolean;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  forceInsertReason?: string;
  isForceInserted?: boolean;
}

const statusOptions = ['全部状态', '待开始', '进行中', '已完成'];
const workshopOptions = ['全部车间', '切片车间', '包装车间', '冷冻车间'];
const dateOptions = ['日期范围', '今天', '本周', '本月'];
const sourceOptions = ['全部来源', '客户订单', 'AI预测', '安全库存', '混批'];
const urgentOptions = ['全部', '仅紧急', '待审批'];

export default function PlanListScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [plans, setPlans] = useState<DisplayPlan[]>([]);
  const [urgentThreshold, setUrgentThreshold] = useState(0.6);
  const [pendingApprovals, setPendingApprovals] = useState<DisplayPlan[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('全部状态');
  const [selectedWorkshop, setSelectedWorkshop] = useState('全部车间');
  const [selectedDate, setSelectedDate] = useState('日期范围');
  const [selectedSource, setSelectedSource] = useState('全部来源');
  const [selectedUrgent, setSelectedUrgent] = useState('全部');
  const [expandedMixedBatch, setExpandedMixedBatch] = useState<string | null>(null);

  // 审批模态框状态
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [selectedPlanForApproval, setSelectedPlanForApproval] = useState<DisplayPlan | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);

  // 转换 ProductionPlanDTO 为 DisplayPlan
  const convertToDisplayPlan = useCallback((dto: ProductionPlanDTO): DisplayPlan => {
    // 根据 crValue 判断 crLevel
    let crLevel: 'urgent' | 'tight' | 'sufficient' | undefined;
    if (dto.crValue !== undefined) {
      if (dto.crValue < 1) crLevel = 'urgent';
      else if (dto.crValue < 1.5) crLevel = 'tight';
      else crLevel = 'sufficient';
    }

    // 根据 sourceType 确定来源
    let sourceType: PlanSourceType = 'manual';
    if (dto.sourceType) {
      const src = dto.sourceType.toLowerCase();
      if (src.includes('customer') || src.includes('order')) sourceType = 'customer_order';
      else if (src.includes('ai') || src.includes('forecast')) sourceType = 'ai_forecast';
      else if (src.includes('safety') || src.includes('stock')) sourceType = 'safety_stock';
      else if (src.includes('mixed') || src.includes('batch')) sourceType = 'mixed_batch';
      else if (src.includes('urgent') || src.includes('insert')) sourceType = 'urgent_insert';
    }

    // 生成标签
    const tags: string[] = [];
    if (dto.isFullyMatched) tags.push('已匹配');
    else if (dto.allocatedQuantity && dto.allocatedQuantity > 0) tags.push('部分匹配');
    else tags.push('待匹配');

    if (dto.isUrgent) tags.push('紧急');
    else if (dto.priority && dto.priority >= 8) tags.push('高优先级');
    else if (dto.priority && dto.priority >= 5) tags.push('中优先级');

    // 计算进度
    const progress = dto.matchingProgress ??
      (dto.allocatedQuantity && dto.plannedQuantity
        ? Math.round((dto.allocatedQuantity / dto.plannedQuantity) * 100)
        : 0);

    return {
      id: dto.id,
      planNumber: dto.planNumber,
      productName: dto.productTypeName || '未命名',
      quantity: dto.plannedQuantity,
      unit: 'kg',
      workshopName: '生产车间', // 后端暂未返回
      supervisorName: '', // 后端暂未返回
      status: dto.status === 'PENDING' ? 'pending'
            : dto.status === 'IN_PROGRESS' ? 'in_progress'
            : dto.status === 'COMPLETED' ? 'completed'
            : 'pending',
      progress,
      sourceType,
      customerName: dto.sourceCustomerName,
      crValue: dto.crValue,
      crLevel,
      deadline: dto.expectedCompletionDate,
      tags,
      isMixedBatch: dto.isMixedBatch,
      forecastReason: dto.forecastReason,
      aiConfidence: dto.aiConfidence ? Math.round(dto.aiConfidence * 100) : undefined,
      isUrgent: dto.isUrgent,
      currentProbability: dto.currentProbability,
      // 审批字段
      requiresApproval: dto.requiresApproval,
      approvalStatus: dto.approvalStatus as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined,
      forceInsertReason: dto.forceInsertReason,
      isForceInserted: dto.isForceInserted,
    };
  }, []);

  // 加载紧急阈值
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

  // 加载计划列表
  const loadPlans = useCallback(async () => {
    try {
      const response = await schedulingApiClient.getPendingBatches({});
      if (response.success && response.data) {
        // 紧急置顶，按完成概率升序排列
        const sorted = [...response.data].sort((a, b) => {
          if (a.isUrgent && !b.isUrgent) return -1;
          if (!a.isUrgent && b.isUrgent) return 1;
          const probA = a.currentProbability ?? 1;
          const probB = b.currentProbability ?? 1;
          return probA - probB;
        });
        setPlans(sorted.map(convertToDisplayPlan));
      }
    } catch (error) {
      console.error('加载计划列表失败:', error);
      Alert.alert('加载失败', '无法加载生产计划列表，请检查网络');
    }
  }, [convertToDisplayPlan]);

  // 加载待审批列表
  const loadPendingApprovals = useCallback(async () => {
    try {
      const response = await schedulingApiClient.getPendingApprovals();
      if (response.success && response.data) {
        const approvals = response.data.map(convertToDisplayPlan);
        setPendingApprovals(approvals);
        setPendingApprovalsCount(approvals.length);
      }
    } catch (error) {
      console.warn('加载待审批列表失败:', error);
      setPendingApprovals([]);
      setPendingApprovalsCount(0);
    }
  }, [convertToDisplayPlan]);

  // 初始加载
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadUrgentThreshold(), loadPlans(), loadPendingApprovals()]);
      setLoading(false);
    };
    init();
  }, [loadUrgentThreshold, loadPlans, loadPendingApprovals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadPlans(), loadPendingApprovals()]);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadPlans, loadPendingApprovals]);

  // 打开审批模态框
  const openApprovalModal = useCallback((plan: DisplayPlan, action: 'approve' | 'reject') => {
    setSelectedPlanForApproval(plan);
    setApprovalAction(action);
    setApprovalComment('');
    setApprovalModalVisible(true);
  }, []);

  // 提交审批操作
  const handleApprovalSubmit = useCallback(async () => {
    if (!selectedPlanForApproval) return;

    setApprovalLoading(true);
    try {
      if (approvalAction === 'approve') {
        await schedulingApiClient.approveForceInsert(
          selectedPlanForApproval.id,
          approvalComment || undefined
        );
        Alert.alert('成功', '已批准该强制插单');
      } else {
        if (!approvalComment.trim()) {
          Alert.alert('提示', '请填写拒绝原因');
          setApprovalLoading(false);
          return;
        }
        await schedulingApiClient.rejectForceInsert(
          selectedPlanForApproval.id,
          approvalComment
        );
        Alert.alert('成功', '已拒绝该强制插单');
      }

      setApprovalModalVisible(false);
      // 刷新列表
      await loadPendingApprovals();
      await loadPlans();
    } catch (error) {
      console.error('审批操作失败:', error);
      Alert.alert('失败', '审批操作失败，请稍后重试');
    } finally {
      setApprovalLoading(false);
    }
  }, [selectedPlanForApproval, approvalAction, approvalComment, loadPendingApprovals, loadPlans]);

  // 筛选计划
  const filteredPlans = React.useMemo(() => {
    // 待审批模式：直接返回 pendingApprovals
    if (selectedUrgent === '待审批') {
      // 可选：对待审批列表也应用搜索
      if (!searchText) return pendingApprovals;
      const lower = searchText.toLowerCase();
      return pendingApprovals.filter(plan =>
        plan.planNumber.toLowerCase().includes(lower) ||
        plan.productName.toLowerCase().includes(lower)
      );
    }

    // 正常筛选模式
    return plans.filter(plan => {
      // 紧急筛选
      if (selectedUrgent === '仅紧急' && !plan.isUrgent) return false;

      // 状态筛选
      if (selectedStatus !== '全部状态') {
        const statusMap: Record<string, string> = {
          '待开始': 'pending',
          '进行中': 'in_progress',
          '已完成': 'completed',
        };
        if (plan.status !== statusMap[selectedStatus]) return false;
      }

      // 搜索
      if (searchText) {
        const lower = searchText.toLowerCase();
        if (!plan.planNumber.toLowerCase().includes(lower) &&
            !plan.productName.toLowerCase().includes(lower)) {
          return false;
        }
      }

      return true;
    });
  }, [plans, pendingApprovals, selectedUrgent, selectedStatus, searchText]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#fff7e6', text: '#fa8c16', label: '待开始' };
      case 'in_progress':
        return { bg: '#e6f7ff', text: '#1890ff', label: '进行中' };
      case 'completed':
        return { bg: '#f6ffed', text: '#52c41a', label: '已完成' };
      default:
        return { bg: '#f5f5f5', text: '#999', label: status };
    }
  };

  const getCrLevelStyle = (level?: string) => {
    switch (level) {
      case 'urgent':
        return { bg: '#fff1f0', text: '#ff4d4f', label: '紧急' };
      case 'tight':
        return { bg: '#fff7e6', text: '#fa8c16', label: '较紧' };
      case 'sufficient':
        return { bg: '#f6ffed', text: '#52c41a', label: '充裕' };
      default:
        return { bg: '#f5f5f5', text: '#999', label: '' };
    }
  };

  const getSourceBadge = (plan: DisplayPlan) => {
    switch (plan.sourceType) {
      case 'customer_order':
        return (
          <View style={[styles.sourceBadge, { backgroundColor: '#e6f7ff' }]}>
            <Text style={[styles.sourceBadgeText, { color: '#1890ff' }]}>客户订单</Text>
          </View>
        );
      case 'mixed_batch':
        return (
          <View style={[styles.sourceBadge, { backgroundColor: '#f9f0ff' }]}>
            <Text style={[styles.sourceBadgeText, { color: DISPATCHER_THEME.primary }]}>混批</Text>
          </View>
        );
      case 'ai_forecast':
        return (
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sourceBadge}
          >
            <Text style={[styles.sourceBadgeText, { color: '#fff' }]}>AI预测</Text>
          </LinearGradient>
        );
      case 'safety_stock':
        return (
          <View style={[styles.sourceBadge, { backgroundColor: '#f6ffed', borderWidth: 1, borderColor: '#b7eb8f' }]}>
            <Text style={[styles.sourceBadgeText, { color: '#52c41a' }]}>安全库存</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const renderPlanCard = (plan: DisplayPlan) => {
    const statusStyle = getStatusStyle(plan.status);
    const crStyle = getCrLevelStyle(plan.crLevel);
    const isExpanded = expandedMixedBatch === plan.id;

    return (
      <TouchableOpacity
        key={plan.id}
        style={styles.planCard}
        onPress={() => navigation.navigate('PlanDetail', { planId: plan.id })}
      >
        {/* Header */}
        <View style={styles.planHeader}>
          <View style={styles.planIdRow}>
            <Text style={styles.planId}>{plan.planNumber}</Text>
            {plan.isUrgent && (
              <View style={styles.urgentBadge}>
                <MaterialCommunityIcons name="alert" size={10} color="#fff" />
                <Text style={styles.urgentBadgeText}>紧急</Text>
              </View>
            )}
            {plan.isMixedBatch && (
              <View style={styles.mixedBadge}>
                <Text style={styles.mixedBadgeText}>混批</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            {plan.currentProbability !== undefined && (
              <View style={[
                styles.probabilityBadge,
                { backgroundColor: plan.currentProbability < urgentThreshold ? '#fff1f0' : '#f6ffed' }
              ]}>
                <Text style={[
                  styles.probabilityText,
                  { color: plan.currentProbability < urgentThreshold ? '#ff4d4f' : '#52c41a' }
                ]}>
                  {Math.round(plan.currentProbability * 100)}%
                </Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
            </View>
          </View>
        </View>

        {/* Info */}
        <Text style={styles.planInfo}>
          {plan.productName} · {plan.quantity}{plan.unit}
          {plan.mergedOrderCount && (
            <Text style={styles.mergedCount}> (合并{plan.mergedOrderCount}个订单)</Text>
          )}
        </Text>
        <Text style={styles.planWorkshop}>{plan.workshopName} · {plan.supervisorName}</Text>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressFill, { width: `${plan.progress}%` }]} />
        </View>

        {/* Source Info */}
        <View style={styles.sourceSection}>
          <View style={styles.sourceRow}>
            <Text style={styles.sourceLabel}>来源:</Text>
            {getSourceBadge(plan)}
            {plan.sourceType === 'customer_order' && (
              <Text style={styles.customerName}>{plan.customerName}</Text>
            )}
            {plan.sourceType === 'mixed_batch' && (
              <Text style={styles.relatedOrdersText}>
                {plan.relatedOrders?.map(o => o.orderId).join(' + ')}
              </Text>
            )}
            {plan.sourceType === 'ai_forecast' && (
              <Text style={styles.forecastReason}>{plan.forecastReason}</Text>
            )}
            {plan.sourceType === 'safety_stock' && (
              <Text style={styles.stockWarning}>库存低于30%触发</Text>
            )}
          </View>

          <View style={styles.sourceMetaRow}>
            {plan.crValue !== undefined && (
              <View style={styles.crValueContainer}>
                <Text style={styles.crLabel}>CR值: </Text>
                <Text style={[styles.crValue, { color: crStyle.text }]}>{plan.crValue}</Text>
                <View style={[styles.crBadge, { backgroundColor: crStyle.bg }]}>
                  <Text style={[styles.crBadgeText, { color: crStyle.text }]}>{crStyle.label}</Text>
                </View>
              </View>
            )}
            {plan.deadline && (
              <Text style={styles.deadlineText}>
                {plan.sourceType === 'mixed_batch' ? '最早交期' : '交期'}: {plan.deadline}
              </Text>
            )}
            {plan.sourceType === 'ai_forecast' && plan.aiConfidence && (
              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceLabel}>预测置信度:</Text>
                <Text style={styles.confidenceValue}>{plan.aiConfidence}%</Text>
                <MaterialCommunityIcons name="check-circle" size={12} color="#52c41a" />
              </View>
            )}
            {plan.sourceType === 'ai_forecast' && plan.season && (
              <Text style={styles.seasonText}>季节性: <Text style={{ color: '#1890ff' }}>{plan.season}</Text></Text>
            )}
            {plan.sourceType === 'safety_stock' && plan.stockLevel !== undefined && (
              <Text style={styles.stockLevel}>
                当前库存: <Text style={{ color: '#ff4d4f' }}>{plan.stockLevel}%</Text>
              </Text>
            )}
          </View>
        </View>

        {/* Mixed Batch Details */}
        {plan.isMixedBatch && (
          <TouchableOpacity
            style={styles.mixedDetails}
            onPress={() => setExpandedMixedBatch(isExpanded ? null : plan.id)}
          >
            <View style={styles.mixedDetailsHeader}>
              <MaterialCommunityIcons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={DISPATCHER_THEME.primary}
              />
              <Text style={styles.mixedDetailsTitle}>混批详情</Text>
            </View>
            {isExpanded && plan.relatedOrders && (
              <View style={styles.mixedOrdersList}>
                {plan.relatedOrders.map((order, index) => (
                  <Text key={order.orderId} style={styles.mixedOrderItem}>
                    {index === plan.relatedOrders!.length - 1 ? '└─' : '├─'} {order.orderId}:{' '}
                    <Text style={{ color: '#333' }}>{order.customerName}</Text> {order.quantity}袋
                  </Text>
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* 审批操作区域 - 仅对需要审批的计划显示 */}
        {plan.requiresApproval && plan.approvalStatus === 'PENDING' && (
          <View style={styles.approvalSection}>
            <View style={styles.approvalHeader}>
              <View style={styles.approvalBadge}>
                <MaterialCommunityIcons name="alert-circle" size={12} color="#fff" />
                <Text style={styles.approvalBadgeText}>需审批</Text>
              </View>
              {plan.isForceInserted && (
                <Text style={styles.forceInsertLabel}>强制插单</Text>
              )}
            </View>
            {plan.forceInsertReason && (
              <Text style={styles.forceInsertReason}>
                原因: {plan.forceInsertReason}
              </Text>
            )}
            <View style={styles.approvalButtons}>
              <TouchableOpacity
                style={styles.approveButton}
                onPress={(e) => {
                  e.stopPropagation();
                  openApprovalModal(plan, 'approve');
                }}
              >
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
                <Text style={styles.approveButtonText}>批准</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={(e) => {
                  e.stopPropagation();
                  openApprovalModal(plan, 'reject');
                }}
              >
                <MaterialCommunityIcons name="close" size={16} color="#fff" />
                <Text style={styles.rejectButtonText}>拒绝</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tags */}
        <View style={styles.tagsRow}>
          {plan.tags?.map((tag, index) => (
            <View
              key={index}
              style={[
                styles.tag,
                tag.includes('已') ? styles.tagMatched : styles.tagPending,
                tag.includes('高') ? styles.tagHighPriority : {},
              ]}
            >
              <Text style={[
                styles.tagText,
                tag.includes('已') ? styles.tagMatchedText : styles.tagPendingText,
                tag.includes('高') ? styles.tagHighPriorityText : {},
              ]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>生产计划</Text>
        <TouchableOpacity onPress={() => navigation.navigate('PlanCreate')}>
          <Text style={styles.addButton}>+ 新建</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Filters */}
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterSelect}>
            <Text style={styles.filterSelectText}>{selectedStatus}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterSelect}>
            <Text style={styles.filterSelectText}>{selectedWorkshop}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterSelect}>
            <Text style={styles.filterSelectText}>{selectedDate}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterSelect}>
            <Text style={styles.filterSelectText}>{selectedSource}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Search Box */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索计划编号/产品名称..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Quick Entry */}
        <View style={styles.quickEntryRow}>
          <TouchableOpacity
            style={styles.quickEntry}
            onPress={() => navigation.navigate('PlanGantt' as never)}
          >
            <MaterialCommunityIcons name="chart-gantt" size={24} color={DISPATCHER_THEME.secondary} />
            <Text style={styles.quickEntryText}>甘特图</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickEntry}
            onPress={() => navigation.navigate('UrgentInsert' as never)}
          >
            <MaterialCommunityIcons name="lightning-bolt" size={24} color="#ff4d4f" />
            <Text style={styles.quickEntryText}>紧急插单</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickEntry, styles.quickEntryWithBadge]}
            onPress={() => navigation.navigate('MixedBatch' as never)}
          >
            <View style={styles.quickEntryBadge}>
              <Text style={styles.quickEntryBadgeText}>3</Text>
            </View>
            <MaterialCommunityIcons name="view-grid" size={24} color={DISPATCHER_THEME.primary} />
            <Text style={styles.quickEntryText}>混批排产</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickEntry}
            onPress={() => navigation.navigate('ResourceOverview' as never)}
          >
            <MaterialCommunityIcons name="monitor-dashboard" size={24} color="#52c41a" />
            <Text style={styles.quickEntryText}>资源总览</Text>
          </TouchableOpacity>
        </View>

        {/* Urgent Filter Toggle */}
        <View style={styles.urgentFilterRow}>
          <TouchableOpacity
            style={[
              styles.urgentFilterChip,
              selectedUrgent === '全部' && styles.urgentFilterChipActive,
            ]}
            onPress={() => setSelectedUrgent('全部')}
          >
            <Text style={[
              styles.urgentFilterText,
              selectedUrgent === '全部' && styles.urgentFilterTextActive,
            ]}>全部</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.urgentFilterChip,
              selectedUrgent === '仅紧急' && styles.urgentFilterChipUrgent,
            ]}
            onPress={() => setSelectedUrgent('仅紧急')}
          >
            <MaterialCommunityIcons
              name="alert"
              size={12}
              color={selectedUrgent === '仅紧急' ? '#fff' : '#ff4d4f'}
            />
            <Text style={[
              styles.urgentFilterText,
              selectedUrgent === '仅紧急' && styles.urgentFilterTextActive,
              selectedUrgent !== '仅紧急' && { color: '#ff4d4f' },
            ]}>仅紧急</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.urgentFilterChip,
              selectedUrgent === '待审批' && styles.urgentFilterChipApproval,
            ]}
            onPress={() => setSelectedUrgent('待审批')}
          >
            <MaterialCommunityIcons
              name="clipboard-check-outline"
              size={12}
              color={selectedUrgent === '待审批' ? '#fff' : '#fa8c16'}
            />
            <Text style={[
              styles.urgentFilterText,
              selectedUrgent === '待审批' && styles.urgentFilterTextActive,
              selectedUrgent !== '待审批' && { color: '#fa8c16' },
            ]}>待审批</Text>
            {pendingApprovalsCount > 0 && (
              <View style={styles.approvalCountBadge}>
                <Text style={styles.approvalCountText}>{pendingApprovalsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.urgentCountBadge}>
            <Text style={styles.urgentCountText}>
              {plans.filter(p => p.isUrgent).length}个紧急
            </Text>
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedUrgent === '仅紧急' ? '紧急计划' :
             selectedUrgent === '待审批' ? '待审批计划' : '今日计划'} ({filteredPlans.length}个)
          </Text>
        </View>

        {/* Loading / Empty / Plan Cards */}
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>加载中...</Text>
          </View>
        ) : filteredPlans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>暂无计划</Text>
          </View>
        ) : (
          filteredPlans.map(renderPlanCard)
        )}

        {/* Load More */}
        <Text style={styles.loadMore}>加载更多...</Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 审批模态框 */}
      <Modal
        visible={approvalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setApprovalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {approvalAction === 'approve' ? '批准插单' : '拒绝插单'}
              </Text>
              <TouchableOpacity
                onPress={() => setApprovalModalVisible(false)}
                disabled={approvalLoading}
              >
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedPlanForApproval && (
              <View style={styles.modalPlanInfo}>
                <Text style={styles.modalPlanNumber}>
                  {selectedPlanForApproval.planNumber}
                </Text>
                <Text style={styles.modalPlanProduct}>
                  {selectedPlanForApproval.productName} · {selectedPlanForApproval.quantity}{selectedPlanForApproval.unit}
                </Text>
                {selectedPlanForApproval.forceInsertReason && (
                  <Text style={styles.modalReason}>
                    插单原因: {selectedPlanForApproval.forceInsertReason}
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.modalLabel}>
              {approvalAction === 'approve' ? '审批备注 (可选)' : '拒绝原因 (必填)'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={approvalAction === 'approve' ? '请输入审批备注...' : '请输入拒绝原因...'}
              placeholderTextColor="#999"
              value={approvalComment}
              onChangeText={setApprovalComment}
              multiline
              numberOfLines={3}
              editable={!approvalLoading}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setApprovalModalVisible(false)}
                disabled={approvalLoading}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  approvalAction === 'reject' && styles.modalRejectConfirmButton,
                ]}
                onPress={handleApprovalSubmit}
                disabled={approvalLoading}
              >
                {approvalLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {approvalAction === 'approve' ? '确认批准' : '确认拒绝'}
                  </Text>
                )}
              </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    fontSize: 14,
    color: DISPATCHER_THEME.secondary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterSelect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterSelectText: {
    fontSize: 12,
    color: '#666',
  },
  chipScroll: {
    marginBottom: 12,
  },
  chipContainer: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipActive: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  chipText: {
    fontSize: 12,
    color: '#666',
  },
  chipTextActive: {
    color: '#fff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  quickEntryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickEntry: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickEntryWithBadge: {
    position: 'relative',
  },
  quickEntryBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff4d4f',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  quickEntryBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  quickEntryText: {
    fontSize: 11,
    color: '#333',
    marginTop: 4,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  mixedBadge: {
    backgroundColor: DISPATCHER_THEME.primary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  mixedBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  planInfo: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  mergedCount: {
    fontSize: 11,
    color: '#999',
  },
  planWorkshop: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: DISPATCHER_THEME.primary,
    borderRadius: 2,
  },
  sourceSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    marginTop: 2,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sourceLabel: {
    fontSize: 11,
    color: '#666',
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  customerName: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  relatedOrdersText: {
    fontSize: 11,
    color: DISPATCHER_THEME.primary,
  },
  forecastReason: {
    fontSize: 12,
    color: '#333',
  },
  stockWarning: {
    fontSize: 12,
    color: '#fa8c16',
  },
  sourceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  crValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crLabel: {
    fontSize: 11,
    color: '#666',
  },
  crValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  crBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  crBadgeText: {
    fontSize: 10,
  },
  deadlineText: {
    fontSize: 11,
    color: '#666',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  confidenceLabel: {
    fontSize: 11,
    color: '#666',
  },
  confidenceValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#52c41a',
  },
  seasonText: {
    fontSize: 11,
    color: '#666',
  },
  stockLevel: {
    fontSize: 11,
    color: '#666',
  },
  mixedDetails: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fafafa',
    borderRadius: 6,
  },
  mixedDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mixedDetailsTitle: {
    fontSize: 11,
    color: DISPATCHER_THEME.primary,
  },
  mixedOrdersList: {
    paddingLeft: 16,
    marginTop: 6,
  },
  mixedOrderItem: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  tagMatched: {
    backgroundColor: '#f6ffed',
  },
  tagPending: {
    backgroundColor: '#fff7e6',
  },
  tagHighPriority: {
    backgroundColor: '#fff1f0',
  },
  tagText: {
    fontSize: 10,
  },
  tagMatchedText: {
    color: '#52c41a',
  },
  tagPendingText: {
    color: '#fa8c16',
  },
  tagHighPriorityText: {
    color: '#ff4d4f',
  },
  loadMore: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 20,
  },
  // 紧急状态相关样式
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4d4f',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    gap: 2,
  },
  urgentBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  probabilityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  probabilityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // 紧急筛选行样式
  urgentFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  urgentFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 4,
  },
  urgentFilterChipActive: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  urgentFilterChipUrgent: {
    backgroundColor: '#ff4d4f',
    borderColor: '#ff4d4f',
  },
  urgentFilterChipApproval: {
    backgroundColor: '#fa8c16',
    borderColor: '#fa8c16',
  },
  approvalCountBadge: {
    marginLeft: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  approvalCountText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  urgentFilterText: {
    fontSize: 12,
    color: '#666',
  },
  urgentFilterTextActive: {
    color: '#fff',
  },
  urgentCountBadge: {
    marginLeft: 'auto',
    backgroundColor: '#fff1f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  urgentCountText: {
    fontSize: 11,
    color: '#ff4d4f',
    fontWeight: '500',
  },
  // 空状态样式
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  // 审批区域样式
  approvalSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff7e6',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#fa8c16',
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  approvalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fa8c16',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  approvalBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  forceInsertLabel: {
    fontSize: 12,
    color: '#fa8c16',
    fontWeight: '500',
  },
  forceInsertReason: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    lineHeight: 18,
  },
  approvalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#52c41a',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 4,
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff4d4f',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 4,
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // 模态框样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalPlanInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalPlanNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: DISPATCHER_THEME.primary,
    marginBottom: 4,
  },
  modalPlanProduct: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  modalReason: {
    fontSize: 12,
    color: '#fa8c16',
    marginTop: 4,
  },
  modalLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalCancelText: {
    fontSize: 14,
    color: '#666',
  },
  modalConfirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#52c41a',
  },
  modalRejectConfirmButton: {
    backgroundColor: '#ff4d4f',
  },
  modalConfirmText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
