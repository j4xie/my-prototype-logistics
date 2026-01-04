/**
 * 任务分配屏幕
 *
 * 功能:
 * - 任务统计概览 (待分配/进行中/已分配/已完成)
 * - 筛选器 (按状态筛选)
 * - 待分配任务卡片 - 显示任务详情和分配按钮
 * - 进行中任务卡片 - 显示进度和追加人员选项
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { isAxiosError } from 'axios';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// 调度员主题色
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

// 类型定义
interface TaskStats {
  pending: number;
  inProgress: number;
  assigned: number;
  completed: number;
}

interface Task {
  id: string;
  name: string;
  product: string;
  quantity: string;
  workshop: string;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'assigned' | 'completed';
  requiredWorkers: number;
  assignedWorkers: number;
  progress?: number;
  supervisor?: string;
}

type FilterType = 'pending' | 'in_progress' | 'completed' | 'all';

/**
 * TODO: P2 Mock数据替换
 *
 * 建议使用的API:
 * - schedulingApiClient.getDashboard() - 获取调度仪表盘统计数据
 * - schedulingApiClient.getPlans() - 获取调度计划列表
 * - schedulingApiClient.getPendingBatches() - 获取待排产批次
 * - schedulingApiClient.getWorkerAssignments() - 获取工人分配列表
 *
 * 数据转换建议:
 * - TaskStats 可从 getDashboard() 的统计数据中获取
 * - Task 可从 getPlans() + getWorkerAssignments() 组合获取
 */

// 默认空数据（替代原Mock数据）
const defaultTaskStats: TaskStats = {
  pending: 0,
  inProgress: 0,
  assigned: 0,
  completed: 0,
};

export default function TaskAssignmentScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TaskStats>(defaultTaskStats);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('pending');

  // 加载任务数据
  const loadData = useCallback(async () => {
    try {
      // 使用 getDashboard 获取统计数据
      const dashboardResponse = await schedulingApiClient.getDashboard();
      if (dashboardResponse.success && dashboardResponse.data) {
        const dashboard = dashboardResponse.data;
        // 从仪表盘数据中提取统计信息
        // SchedulingDashboard type has overview.totalPlans, activePlans, etc.
        setStats({
          pending: dashboard.overview?.totalPlans - dashboard.overview?.activePlans - dashboard.overview?.completedPlans || 0,
          inProgress: dashboard.overview?.activePlans || 0,
          assigned: 0, // Dashboard doesn't provide assigned count separately
          completed: dashboard.overview?.completedPlans || 0,
        });

        // Dashboard doesn't have todaySchedules - need to fetch plans separately
        // For now, try to get plans list
        try {
          const todayDate = new Date().toISOString().split('T')[0];
          const plansResponse = await schedulingApiClient.getPlans({
            startDate: todayDate,
            endDate: todayDate,
            page: 0,
            size: 50,
          });

          if (plansResponse.success && plansResponse.data?.content) {
            const transformedTasks: Task[] = [];
            for (const plan of plansResponse.data.content) {
              // Each plan may have lineSchedules
              if (plan.lineSchedules && plan.lineSchedules.length > 0) {
                for (const schedule of plan.lineSchedules) {
                  const scheduleStatus = schedule.status?.toLowerCase();
                  transformedTasks.push({
                    id: schedule.id || String(plan.id),
                    name: schedule.productionPlanNumber || `计划-${plan.id}`,
                    product: schedule.productTypeName || '未知产品',
                    quantity: `${schedule.plannedQuantity || 0}kg`,
                    workshop: schedule.productionLineName || '未分配',
                    deadline: schedule.plannedEndTime || '-',
                    priority: 'medium', // SchedulingPlan doesn't have priority field
                    status: scheduleStatus === 'in_progress' ? 'in_progress' :
                            scheduleStatus === 'completed' ? 'completed' :
                            scheduleStatus === 'confirmed' ? 'assigned' : 'pending',
                    requiredWorkers: schedule.workerCount || 4,
                    assignedWorkers: schedule.workerAssignments?.length || 0,
                    progress: schedule.actualQuantity && schedule.plannedQuantity
                      ? Math.round((schedule.actualQuantity / schedule.plannedQuantity) * 100)
                      : 0,
                    supervisor: undefined,
                  });
                }
              } else {
                // No lineSchedules, create a task from the plan itself
                transformedTasks.push({
                  id: String(plan.id),
                  name: `计划-${plan.id}`,
                  product: plan.productTypeName || '未知产品',
                  quantity: `${plan.estimatedOutput || 0}kg`,
                  workshop: '未分配',
                  deadline: plan.planDate || '-',
                  priority: 'medium',
                  status: plan.status === 'in_progress' ? 'in_progress' :
                          plan.status === 'completed' ? 'completed' :
                          plan.status === 'confirmed' ? 'assigned' : 'pending',
                  requiredWorkers: plan.totalWorkers || 4,
                  assignedWorkers: 0,
                  progress: plan.actualOutput && plan.estimatedOutput
                    ? Math.round((plan.actualOutput / plan.estimatedOutput) * 100)
                    : 0,
                  supervisor: undefined,
                });
              }
            }
            setTasks(transformedTasks);
          }
        } catch (plansError) {
          console.error('获取计划列表失败:', plansError);
        }
      }
    } catch (error) {
      console.error('加载任务数据失败:', error);
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          Alert.alert('登录已过期', '请重新登录');
        } else {
          Alert.alert('加载失败', error.response?.data?.message || '网络错误');
        }
      }
    }
  }, []);

  // 初始加载
  useEffect(() => {
    const initLoad = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    initLoad();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleAssignTask = (task: Task) => {
    // TODO: 导航到人员分配页面
    Alert.alert(
      '分配任务',
      `即将为任务 ${task.name} 分配人员\n所需人员: ${task.requiredWorkers}人`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '开始分配',
          onPress: () => {
            // 导航到 BatchWorkersScreen
            (navigation as any).navigate('BatchWorkers', {
              taskId: task.id,
              taskName: task.name,
              requiredWorkers: task.requiredWorkers,
            });
          }
        },
      ]
    );
  };

  const handleAddWorkers = (task: Task) => {
    Alert.alert(
      '追加人员',
      `当前已分配 ${task.assignedWorkers}/${task.requiredWorkers} 人\n是否追加人员?`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '追加',
          onPress: () => {
            (navigation as any).navigate('BatchWorkers', {
              taskId: task.id,
              taskName: task.name,
              requiredWorkers: task.requiredWorkers,
              isAddition: true,
            });
          }
        },
      ]
    );
  };

  const filteredTasks = tasks.filter(task => {
    if (activeFilter === 'all') return true;
    return task.status === activeFilter;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return DISPATCHER_THEME.danger;
      case 'medium': return DISPATCHER_THEME.warning;
      case 'low': return DISPATCHER_THEME.success;
      default: return DISPATCHER_THEME.info;
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高优先级';
      case 'medium': return '中优先级';
      case 'low': return '低优先级';
      default: return '普通';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待分配';
      case 'in_progress': return '进行中';
      case 'assigned': return '已分配';
      case 'completed': return '已完成';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return DISPATCHER_THEME.warning;
      case 'in_progress': return DISPATCHER_THEME.info;
      case 'assigned': return DISPATCHER_THEME.primary;
      case 'completed': return DISPATCHER_THEME.success;
      default: return '#999';
    }
  };

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <View style={[styles.statCard, { borderLeftColor: DISPATCHER_THEME.warning }]}>
        <Text style={styles.statValue}>{stats.pending}</Text>
        <Text style={styles.statLabel}>待分配</Text>
      </View>
      <View style={[styles.statCard, { borderLeftColor: DISPATCHER_THEME.info }]}>
        <Text style={styles.statValue}>{stats.inProgress}</Text>
        <Text style={styles.statLabel}>进行中</Text>
      </View>
      <View style={[styles.statCard, { borderLeftColor: DISPATCHER_THEME.primary }]}>
        <Text style={styles.statValue}>{stats.assigned}</Text>
        <Text style={styles.statLabel}>已分配</Text>
      </View>
      <View style={[styles.statCard, { borderLeftColor: DISPATCHER_THEME.success }]}>
        <Text style={styles.statValue}>{stats.completed}</Text>
        <Text style={styles.statLabel}>已完成</Text>
      </View>
    </View>
  );

  const renderFilters = () => {
    const filters: { key: FilterType; label: string }[] = [
      { key: 'pending', label: '待分配' },
      { key: 'in_progress', label: '进行中' },
      { key: 'completed', label: '已完成' },
      { key: 'all', label: '全部' },
    ];

    return (
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                activeFilter === filter.key && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter.key && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderPendingTask = (task: Task) => (
    <View key={task.id} style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <Text style={styles.taskName}>{task.name}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) + '20' }]}>
            <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
              {getPriorityText(task.priority)}
            </Text>
          </View>
        </View>
        <Text style={styles.taskProduct}>{task.product} · {task.quantity}</Text>
      </View>

      <View style={styles.taskDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text style={styles.detailText}>{task.workshop}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={14} color="#666" />
          <Text style={styles.detailText}>截止: {task.deadline}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="people-outline" size={14} color="#666" />
          <Text style={styles.detailText}>需要 {task.requiredWorkers} 人</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.assignButton}
        onPress={() => handleAssignTask(task)}
      >
        <LinearGradient
          colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.assignButtonGradient}
        >
          <Ionicons name="person-add-outline" size={16} color="#fff" />
          <Text style={styles.assignButtonText}>立即分配</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderInProgressTask = (task: Task) => (
    <View key={task.id} style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <Text style={styles.taskName}>{task.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(task.status) }]}>
              {getStatusText(task.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.taskProduct}>{task.product} · {task.quantity}</Text>
      </View>

      {/* 进度条 */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>完成进度</Text>
          <Text style={styles.progressValue}>{task.progress}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${task.progress ?? 0}%`,
                backgroundColor: task.progress && task.progress >= 80
                  ? DISPATCHER_THEME.success
                  : DISPATCHER_THEME.info,
              }
            ]}
          />
        </View>
      </View>

      <View style={styles.taskDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#666" />
          <Text style={styles.detailText}>负责人: {task.supervisor}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="people-outline" size={14} color="#666" />
          <Text style={styles.detailText}>
            人员: {task.assignedWorkers}/{task.requiredWorkers} 人
            {task.assignedWorkers < task.requiredWorkers && (
              <Text style={{ color: DISPATCHER_THEME.warning }}> (人员不足)</Text>
            )}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={14} color="#666" />
          <Text style={styles.detailText}>截止: {task.deadline}</Text>
        </View>
      </View>

      {task.assignedWorkers < task.requiredWorkers && (
        <TouchableOpacity
          style={styles.addWorkersButton}
          onPress={() => handleAddWorkers(task)}
        >
          <Ionicons name="add-circle-outline" size={16} color={DISPATCHER_THEME.primary} />
          <Text style={styles.addWorkersText}>追加人员</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderCompletedTask = (task: Task) => (
    <View key={task.id} style={[styles.taskCard, styles.taskCardCompleted]}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <Text style={[styles.taskName, { color: '#999' }]}>{task.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: DISPATCHER_THEME.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={14} color={DISPATCHER_THEME.success} />
            <Text style={[styles.statusText, { color: DISPATCHER_THEME.success, marginLeft: 4 }]}>
              已完成
            </Text>
          </View>
        </View>
        <Text style={[styles.taskProduct, { color: '#999' }]}>{task.product} · {task.quantity}</Text>
      </View>

      <View style={styles.taskDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#999" />
          <Text style={[styles.detailText, { color: '#999' }]}>负责人: {task.supervisor}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="people-outline" size={14} color="#999" />
          <Text style={[styles.detailText, { color: '#999' }]}>
            人员: {task.assignedWorkers} 人
          </Text>
        </View>
      </View>
    </View>
  );

  const renderTask = (task: Task) => {
    switch (task.status) {
      case 'pending':
        return renderPendingTask(task);
      case 'in_progress':
        return renderInProgressTask(task);
      case 'completed':
        return renderCompletedTask(task);
      default:
        return renderPendingTask(task);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 头部 */}
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>任务分配</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 统计卡片 */}
        {renderStats()}

        {/* 筛选器 */}
        {renderFilters()}

        {/* 任务列表 */}
        <View style={styles.taskList}>
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => renderTask(task))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>暂无任务</Text>
            </View>
          )}
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  taskList: {
    gap: 12,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskCardCompleted: {
    opacity: 0.7,
  },
  taskHeader: {
    marginBottom: 12,
  },
  taskTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  taskProduct: {
    fontSize: 13,
    color: '#666',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  taskDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
  },
  assignButton: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  assignButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '600',
    color: DISPATCHER_THEME.primary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  addWorkersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DISPATCHER_THEME.primary,
    borderStyle: 'dashed',
    gap: 6,
  },
  addWorkersText: {
    fontSize: 14,
    color: DISPATCHER_THEME.primary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
});
