/**
 * 生产计划详情屏幕
 *
 * 功能:
 * - 计划基本信息展示
 * - 生产进度显示
 * - 原料匹配状态
 * - 已分配员工列表
 * - 关联生产批次
 * - 暂停/完成计划操作
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
  Alert,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';

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

// 计划详情类型
interface PlanDetail {
  id: string;
  planNumber: string;
  product: string;
  quantity: string;
  workshop: string;
  supervisor: string;
  planDate: string;
  priority: 'high' | 'medium' | 'low';
  status: 'draft' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'paused' | 'cancelled';
  progress: number;
  completedQuantity: string;
  remainingQuantity: string;
  estimatedCompletion: string;
}

// 可重排状态列表
const RESCHEDULABLE_STATUSES = ['draft', 'pending', 'confirmed', 'paused'];

// 原料匹配类型
interface MaterialMatch {
  id: string;
  name: string;
  batchNumber: string;
  required: string;
  available: string;
  matched: boolean;
}

// 员工类型
interface AssignedWorker {
  id: string;
  name: string;
  avatar: string;
}

// 生产批次类型
interface ProductionBatch {
  id: string;
  batchNumber: string;
  status: 'pending' | 'in_progress' | 'completed';
  progress: number;
}

// Data transformation helpers
const transformPlanToDetail = (apiPlan: any): PlanDetail => {
  const status = (apiPlan.status || 'pending').toLowerCase();
  const plannedQty = apiPlan.plannedQuantity || 0;
  const actualQty = apiPlan.actualQuantity || 0;
  const progress = plannedQty > 0 ? Math.round((actualQty / plannedQty) * 100) : 0;

  return {
    id: apiPlan.id || '',
    planNumber: apiPlan.planNumber || apiPlan.id || '',
    product: apiPlan.productTypeName || apiPlan.productName || '',
    quantity: `${plannedQty}kg`,
    workshop: apiPlan.workshopName || '生产车间',
    supervisor: apiPlan.supervisorName || apiPlan.createdByName || '',
    planDate: apiPlan.planDate || apiPlan.plannedDate || '',
    priority: apiPlan.priority === 1 ? 'high' : apiPlan.priority === 3 ? 'low' : 'medium',
    status: status as PlanDetail['status'],
    progress,
    completedQuantity: `${actualQty}kg`,
    remainingQuantity: `${Math.max(0, plannedQty - actualQty)}kg`,
    estimatedCompletion: apiPlan.estimatedCompletion || apiPlan.expectedCompletionDate || '',
  };
};

const transformMaterials = (apiMaterials: any[]): MaterialMatch[] => {
  return (apiMaterials || []).map((m, index) => ({
    id: m.id || String(index + 1),
    name: m.materialTypeName || m.name || '',
    batchNumber: m.batchNumber || '',
    required: `${m.requiredQuantity || m.required || 0}${m.unit || 'kg'}`,
    available: `${m.availableQuantity || m.available || 0}${m.unit || 'kg'}`,
    matched: m.matched ?? ((m.availableQuantity || 0) >= (m.requiredQuantity || 0)),
  }));
};

const transformWorkers = (apiWorkers: any[]): AssignedWorker[] => {
  return (apiWorkers || []).map((w, index) => ({
    id: w.id || w.userId || String(index + 1),
    name: w.name || w.workerName || w.userName || '',
    avatar: (w.name || w.workerName || w.userName || '').charAt(0),
  }));
};

const transformBatches = (apiBatches: any[]): ProductionBatch[] => {
  return (apiBatches || []).map((b, index) => ({
    id: b.id || String(index + 1),
    batchNumber: b.batchNumber || '',
    status: (b.status || 'pending').toLowerCase() === 'in_progress' ? 'in_progress' :
            (b.status || 'pending').toLowerCase() === 'completed' ? 'completed' : 'pending',
    progress: b.progress || b.completionPercent || 0,
  }));
};

export default function PlanDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation('dispatcher');
  const params = route.params as { planId?: string } | undefined;
  const planId = params?.planId || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [materials, setMaterials] = useState<MaterialMatch[]>([]);
  const [workers, setWorkers] = useState<AssignedWorker[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);

  // 重排相关状态
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [keepAssignments, setKeepAssignments] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Load plan data from API
  const loadPlanData = useCallback(async () => {
    if (!planId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch plan details
      const planResponse = await schedulingApiClient.getPlan(planId);
      if (planResponse.success && planResponse.data) {
        // Cast to extended type that may include additional fields from API
        const planData = planResponse.data as typeof planResponse.data & {
          materials?: unknown[];
          workers?: unknown[];
          assignedWorkers?: unknown[];
          batches?: unknown[];
          schedules?: unknown[];
        };
        setPlan(transformPlanToDetail(planData));

        // Extract materials from plan if available
        if (planData.materials) {
          setMaterials(transformMaterials(planData.materials));
        }

        // Extract workers from plan if available
        if (planData.workers || planData.assignedWorkers) {
          setWorkers(transformWorkers(planData.workers || planData.assignedWorkers || []));
        }

        // Extract batches from plan if available (may come from lineSchedules)
        if (planData.batches || planData.schedules || planData.lineSchedules) {
          setBatches(transformBatches(planData.batches || planData.schedules || planData.lineSchedules || []));
        }
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          Alert.alert(t('errors.unauthorized'), t('errors.loginExpired'));
        } else if (status === 404) {
          Alert.alert(t('errors.notFound'), t('plan.notFound'));
          navigation.goBack();
        } else {
          Alert.alert(t('errors.loadFailed'), error.response?.data?.message || t('plan.loadError'));
        }
      } else if (error instanceof Error) {
        Alert.alert(t('errors.error'), error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [planId, navigation, t]);

  // Load data on mount
  React.useEffect(() => {
    loadPlanData();
  }, [loadPlanData]);

  // 判断是否可以重排
  const canReschedule = plan ? RESCHEDULABLE_STATUSES.includes(plan.status) : false;

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPlanData();
  }, [loadPlanData]);

  // 获取状态标签样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'draft':
        return { backgroundColor: '#f5f5f5', color: '#999' };
      case 'pending':
        return { backgroundColor: '#fff7e6', color: '#fa8c16' };
      case 'confirmed':
        return { backgroundColor: '#f0f5ff', color: '#597ef7' };
      case 'in_progress':
        return { backgroundColor: '#e6f7ff', color: '#1890ff' };
      case 'completed':
        return { backgroundColor: '#f6ffed', color: '#52c41a' };
      case 'paused':
        return { backgroundColor: '#fff1f0', color: '#ff4d4f' };
      case 'cancelled':
        return { backgroundColor: '#fafafa', color: '#bfbfbf' };
      default:
        return { backgroundColor: '#f5f5f5', color: '#666' };
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return '草稿';
      case 'pending':
        return '待开始';
      case 'confirmed':
        return '已确认';
      case 'in_progress':
        return '进行中';
      case 'completed':
        return '已完成';
      case 'paused':
        return '已暂停';
      case 'cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  // 获取优先级样式
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high':
        return { backgroundColor: '#fff1f0', color: '#ff4d4f' };
      case 'medium':
        return { backgroundColor: '#fff7e6', color: '#fa8c16' };
      case 'low':
        return { backgroundColor: '#e6f7ff', color: '#1890ff' };
      default:
        return { backgroundColor: '#f5f5f5', color: '#666' };
    }
  };

  // 暂停计划
  const handlePausePlan = () => {
    Alert.alert(
      '暂停计划',
      '确定要暂停该生产计划吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => {
            // TODO: 调用暂停API
            Alert.alert('成功', '计划已暂停');
          },
        },
      ]
    );
  };

  // 完成计划
  const handleCompletePlan = () => {
    Alert.alert(
      '完成计划',
      '确定要将该计划标记为已完成吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'default',
          onPress: () => {
            // TODO: 调用完成API
            Alert.alert('成功', '计划已完成');
          },
        },
      ]
    );
  };

  // 打开重排弹窗
  const openRescheduleModal = () => {
    setRescheduleReason('');
    setKeepAssignments(true);
    setShowRescheduleModal(true);
  };

  // 关闭重排弹窗
  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setRescheduleReason('');
  };

  // 重新排程
  const handleReschedule = async () => {
    if (!plan) {
      Alert.alert('错误', '计划信息不存在');
      return;
    }
    if (!rescheduleReason.trim()) {
      Alert.alert('提示', '请输入重排原因');
      return;
    }

    setIsRescheduling(true);
    try {
      const result = await schedulingApiClient.reschedule({
        planId: plan.id,
        reason: rescheduleReason.trim(),
        keepAssignments,
      });

      if (result.success) {
        Alert.alert('成功', '排程已重新生成', [
          {
            text: '确定',
            onPress: () => {
              closeRescheduleModal();
              onRefresh(); // 刷新页面数据
            },
          },
        ]);
      } else {
        Alert.alert('失败', result.message || '重新排程失败');
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          Alert.alert('错误', '登录已过期，请重新登录');
        } else if (status === 403) {
          Alert.alert('权限不足', '您没有权限执行此操作');
        } else {
          Alert.alert('失败', error.response?.data?.message || '重新排程失败');
        }
      } else if (error instanceof Error) {
        Alert.alert('错误', error.message);
      } else {
        Alert.alert('失败', '重新排程失败，请稍后重试');
      }
    } finally {
      setIsRescheduling(false);
    }
  };

  // 渲染原料匹配卡片
  const renderMaterialCard = (material: MaterialMatch) => (
    <View
      key={material.id}
      style={[
        styles.materialCard,
        material.matched ? styles.materialMatched : styles.materialUnmatched,
      ]}
    >
      <View style={styles.materialHeader}>
        <View style={styles.materialNameRow}>
          <View
            style={[
              styles.materialIndicator,
              { backgroundColor: material.matched ? DISPATCHER_THEME.success : DISPATCHER_THEME.danger },
            ]}
          />
          <Text style={styles.materialName}>{material.name}</Text>
        </View>
        <Text
          style={[
            styles.materialStatus,
            { color: material.matched ? DISPATCHER_THEME.success : DISPATCHER_THEME.danger },
          ]}
        >
          {material.matched ? '已匹配' : '未匹配'}
        </Text>
      </View>
      <Text style={styles.materialBatch}>批次: {material.batchNumber}</Text>
      <Text style={styles.materialQuantity}>
        需求: {material.required} | 可用: {material.available}
      </Text>
    </View>
  );

  // 渲染生产批次卡片
  const renderBatchCard = (batch: ProductionBatch) => (
    <TouchableOpacity key={batch.id} style={styles.batchCard} activeOpacity={0.7}>
      <View style={styles.batchHeader}>
        <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
        <View
          style={[
            styles.batchStatus,
            getStatusStyle(batch.status),
          ]}
        >
          <Text style={[styles.batchStatusText, { color: getStatusStyle(batch.status).color }]}>
            {batch.status === 'in_progress' ? '生产中' : '待开始'}
          </Text>
        </View>
      </View>
      <Text style={styles.batchProgress}>进度 {batch.progress}%</Text>
    </TouchableOpacity>
  );

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>计划详情</Text>
          <View style={styles.editButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No plan found
  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>计划详情</Text>
          <View style={styles.editButton} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>计划不存在或已被删除</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPlanData}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>计划详情</Text>
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>编辑</Text>
        </TouchableOpacity>
      </View>

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
        {/* 计划信息 */}
        <View style={styles.section}>
          <View style={styles.planHeader}>
            <Text style={styles.planNumber}>{plan.planNumber}</Text>
            <View style={[styles.statusBadge, getStatusStyle(plan.status)]}>
              <Text style={[styles.statusText, { color: getStatusStyle(plan.status).color }]}>
                {getStatusText(plan.status)}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>产品</Text>
            <Text style={styles.detailValue}>{plan.product}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>数量</Text>
            <Text style={styles.detailValue}>{plan.quantity}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>车间</Text>
            <Text style={styles.detailValue}>{plan.workshop}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>负责人</Text>
            <Text style={styles.detailValue}>{plan.supervisor}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>计划日期</Text>
            <Text style={styles.detailValue}>{plan.planDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>优先级</Text>
            <View style={[styles.priorityBadge, getPriorityStyle(plan.priority)]}>
              <Text style={[styles.priorityText, { color: getPriorityStyle(plan.priority).color }]}>
                高
              </Text>
            </View>
          </View>
        </View>

        {/* 生产进度 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>生产进度</Text>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>完成进度</Text>
            <Text style={styles.progressValue}>{plan.progress}%</Text>
          </View>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={[DISPATCHER_THEME.secondary, DISPATCHER_THEME.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${plan.progress}%` }]}
            />
          </View>
          <View style={styles.quantityRow}>
            <Text style={styles.quantityText}>
              已完成: <Text style={styles.quantityValue}>{plan.completedQuantity}</Text>
            </Text>
            <Text style={styles.quantityText}>
              剩余: <Text style={styles.quantityValue}>{plan.remainingQuantity}</Text>
            </Text>
          </View>
          <Text style={styles.estimatedCompletion}>
            预计完成: {plan.estimatedCompletion}
          </Text>
        </View>

        {/* 原料匹配 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>原料匹配</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>重新匹配</Text>
            </TouchableOpacity>
          </View>
          {materials.map(renderMaterialCard)}
        </View>

        {/* 已分配员工 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>已分配员工 ({workers.length}人)</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>+ 分配</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.workersContainer}>
            <View style={styles.avatarGroup}>
              {workers.map((worker) => (
                <View key={worker.id} style={styles.avatar}>
                  <Text style={styles.avatarText}>{worker.avatar}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.workerStats}>
            <Text style={styles.workerStatText}>
              总工时: <Text style={styles.workerStatValue}>480min</Text>
            </Text>
            <Text style={styles.workerStatText}>
              人工成本: <Text style={[styles.workerStatValue, { color: DISPATCHER_THEME.warning }]}>¥400</Text>
            </Text>
          </View>
        </View>

        {/* 关联生产批次 */}
        <View style={[styles.section, { marginBottom: 120 }]}>
          <Text style={styles.sectionTitle}>关联生产批次</Text>
          {batches.map(renderBatchCard)}
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.bottomActions}>
        {canReschedule && (
          <TouchableOpacity
            style={styles.rescheduleButton}
            onPress={openRescheduleModal}
          >
            <Ionicons name="refresh" size={16} color={DISPATCHER_THEME.info} />
            <Text style={styles.rescheduleButtonText}>重新排程</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.secondaryButton, canReschedule && styles.smallerButton]}
          onPress={handlePausePlan}
        >
          <Text style={styles.secondaryButtonText}>暂停计划</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, canReschedule && styles.smallerButton]}
          onPress={handleCompletePlan}
        >
          <LinearGradient
            colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>完成计划</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* 重排确认弹窗 */}
      <Modal
        visible={showRescheduleModal}
        transparent
        animationType="fade"
        onRequestClose={closeRescheduleModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* 弹窗标题 */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="refresh" size={20} color={DISPATCHER_THEME.primary} />
                <Text style={styles.modalTitle}>重新排程</Text>
              </View>
              <TouchableOpacity onPress={closeRescheduleModal} disabled={isRescheduling}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>

            {/* 提示信息 */}
            <Text style={styles.modalHint}>
              重新排程将重新计算生产安排，请说明原因以便追溯。
            </Text>

            {/* 原因输入 */}
            <Text style={styles.inputLabel}>重排原因 <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="请输入重排原因（如：紧急订单插入、工人变动等）"
              placeholderTextColor="#999"
              value={rescheduleReason}
              onChangeText={setRescheduleReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isRescheduling}
            />

            {/* 保留分配选项 */}
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.switchTitle}>保留现有工人分配</Text>
                <Text style={styles.switchDesc}>关闭后将重新分配所有工人</Text>
              </View>
              <Switch
                value={keepAssignments}
                onValueChange={setKeepAssignments}
                trackColor={{ false: '#e0e0e0', true: DISPATCHER_THEME.secondary }}
                thumbColor={keepAssignments ? DISPATCHER_THEME.primary : '#f4f3f4'}
                disabled={isRescheduling}
              />
            </View>

            {/* 操作按钮 */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeRescheduleModal}
                disabled={isRescheduling}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  !rescheduleReason.trim() && styles.modalConfirmButtonDisabled,
                ]}
                onPress={handleReschedule}
                disabled={!rescheduleReason.trim() || isRescheduling}
              >
                {isRescheduling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>确认重排</Text>
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
    backgroundColor: DISPATCHER_THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: DISPATCHER_THEME.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
    padding: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: DISPATCHER_THEME.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLink: {
    fontSize: 12,
    color: DISPATCHER_THEME.secondary,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '600',
    color: DISPATCHER_THEME.secondary,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quantityText: {
    fontSize: 14,
    color: '#999',
  },
  quantityValue: {
    color: '#333',
    fontWeight: '500',
  },
  estimatedCompletion: {
    fontSize: 13,
    color: DISPATCHER_THEME.success,
  },
  materialCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  materialMatched: {
    backgroundColor: '#f6ffed',
    borderColor: '#b7eb8f',
  },
  materialUnmatched: {
    backgroundColor: '#fff1f0',
    borderColor: '#ffccc7',
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  materialNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  materialIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  materialStatus: {
    fontSize: 12,
  },
  materialBatch: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  materialQuantity: {
    fontSize: 13,
    color: '#666',
  },
  workersContainer: {
    marginBottom: 12,
  },
  avatarGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DISPATCHER_THEME.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  workerStats: {
    flexDirection: 'row',
    gap: 24,
  },
  workerStatText: {
    fontSize: 13,
    color: '#999',
  },
  workerStatValue: {
    color: '#333',
    fontWeight: '500',
  },
  batchCard: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  batchStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  batchStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  batchProgress: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    paddingBottom: 34,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  // 重排按钮样式
  rescheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#e6f7ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#91d5ff',
  },
  rescheduleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: DISPATCHER_THEME.info,
  },
  smallerButton: {
    flex: 0.8,
  },
  // 弹窗样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: DISPATCHER_THEME.danger,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
    marginBottom: 16,
  },
  switchLabel: {
    flex: 1,
    marginRight: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  switchDesc: {
    fontSize: 12,
    color: '#999',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: DISPATCHER_THEME.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonDisabled: {
    backgroundColor: '#d9d9d9',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
});
