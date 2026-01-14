/**
 * Workshop Supervisor 首页 Dashboard
 * 任务导向设计: 下一批任务最醒目 + 任务统计 + 进行中批次 + 人员/设备状态
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { WSHomeStackParamList } from '../../../types/navigation';
import { useAuthStore } from '../../../store/authStore';
import { dashboardAPI } from '../../../services/api/dashboardApiClient';
import { processingApiClient } from '../../../services/api/processingApiClient';
import { schedulingApiClient, SupervisorTaskDTO } from '../../../services/api/schedulingApiClient';
import { isAxiosError } from 'axios';

type NavigationProp = NativeStackNavigationProp<WSHomeStackParamList, 'WSHome'>;

// 下一批任务数据类型
interface NextTask {
  batchId: string;
  batchNumber: string;
  productName: string;
  targetQuantity: number;
  plannedStartTime: string;
  workshopLocation: string;
  assignedWorkers: number;
  equipment: string;
  isUrgent: boolean;
}

// 任务统计
interface TaskStats {
  assigned: number;
  inProgress: number;
  completed: number;
}

// 进行中批次
interface InProgressBatch {
  batchId: string;
  batchNumber: string;
  productName: string;
  stage: string;
  progress: number;
  currentOutput: number;
  targetOutput: number;
  estimatedTime: string;
}

// 人员状态
interface PersonnelStatus {
  onDuty: number;
  onLeave: number;
  absent: number;
  total: number;
}

// 设备状态
interface EquipmentStatus {
  running: number;
  idle: number;
  needMaintenance: number;
  total: number;
}

export function WSHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const { t } = useTranslation('workshop');

  // 状态
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 状态数据 - 从API加载
  const [nextTask, setNextTask] = useState<NextTask | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats>({
    assigned: 0,
    inProgress: 0,
    completed: 0,
  });
  const [inProgressBatches, setInProgressBatches] = useState<InProgressBatch[]>([]);
  const [personnelStatus, setPersonnelStatus] = useState<PersonnelStatus>({
    onDuty: 0,
    onLeave: 0,
    absent: 0,
    total: 0,
  });
  const [equipmentStatus, setEquipmentStatus] = useState<EquipmentStatus>({
    running: 0,
    idle: 0,
    needMaintenance: 0,
    total: 0,
  });
  const [scheduleTasks, setScheduleTasks] = useState<SupervisorTaskDTO[]>([]);

  // 获取问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t('home.greeting.earlyMorning');
    if (hour < 9) return t('home.greeting.morning');
    if (hour < 12) return t('home.greeting.forenoon');
    if (hour < 14) return t('home.greeting.noon');
    if (hour < 18) return t('home.greeting.afternoon');
    if (hour < 22) return t('home.greeting.evening');
    return t('home.greeting.lateNight');
  };

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      // 获取Dashboard概览数据
      const overviewRes = await dashboardAPI.getDashboardOverview('today');
      if (overviewRes.success && overviewRes.data) {
        const { summary, todayStats } = overviewRes.data;

        // 更新任务统计
        setTaskStats({
          assigned: summary?.totalBatches || 0,
          inProgress: summary?.activeBatches || 0,
          completed: summary?.completedBatches || 0,
        });

        // 更新人员状态
        setPersonnelStatus({
          onDuty: summary?.onDutyWorkers || todayStats?.activeWorkers || 0,
          onLeave: 0, // TODO: P2 - Backend needs to provide leave count
          absent: (summary?.totalWorkers || 0) - (summary?.onDutyWorkers || 0),
          total: summary?.totalWorkers || todayStats?.totalWorkers || 0,
        });

        // 更新设备状态
        setEquipmentStatus({
          running: todayStats?.activeEquipment || 0,
          idle: (todayStats?.totalEquipment || 0) - (todayStats?.activeEquipment || 0),
          needMaintenance: 0, // TODO: P2 - Backend needs to provide maintenance count
          total: todayStats?.totalEquipment || 0,
        });
      }

      // 获取进行中批次
      const inProgressRes = await processingApiClient.getBatches({ status: 'IN_PROGRESS', page: 1, size: 5 });
      if (inProgressRes.success && inProgressRes.data?.content) {
        const batches = inProgressRes.data.content.map(batch => {
          const progress = batch.actualQuantity && batch.targetQuantity
            ? Math.round((batch.actualQuantity / batch.targetQuantity) * 100)
            : 0;
          return {
            batchId: String(batch.id),
            batchNumber: batch.batchNumber,
            productName: batch.productType,
            stage: batch.status === 'IN_PROGRESS' ? '加工中' : batch.status,
            progress,
            currentOutput: batch.actualQuantity || 0,
            targetOutput: batch.targetQuantity,
            estimatedTime: batch.endTime ? new Date(batch.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
          };
        });
        setInProgressBatches(batches);
      }

      // 获取下一批任务（待开始的批次）
      const pendingRes = await processingApiClient.getBatches({ status: 'PENDING', page: 1, size: 1 });
      if (pendingRes.success && pendingRes.data?.content?.length > 0) {
        const batch = pendingRes.data.content[0];
        setNextTask({
          batchId: String(batch.id),
          batchNumber: batch.batchNumber,
          productName: batch.productType,
          targetQuantity: batch.targetQuantity,
          plannedStartTime: batch.startTime ? new Date(batch.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
          workshopLocation: 'A区', // Note: Workshop location not in ProcessingBatch, using default
          assignedWorkers: 0, // Note: Assigned workers not in ProcessingBatch
          equipment: '', // Note: Equipment not in ProcessingBatch
          isUrgent: false, // Note: Urgency not in ProcessingBatch
        });
      } else {
        // 无待处理任务
        setNextTask(null);
      }

      // 获取排程任务
      try {
        const tasksRes = await schedulingApiClient.getSupervisorTasks('pending,in_progress');
        if (tasksRes.success && tasksRes.data) {
          setScheduleTasks(tasksRes.data);
        }
      } catch (scheduleError) {
        console.error('获取排程任务失败:', scheduleError);
      }
    } catch (error) {
      console.error('加载车间主管首页数据失败:', error);
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          // TODO: Handle auth expired
          console.error('认证过期，请重新登录');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // 开始任务
  const handleStartTask = () => {
    if (nextTask) {
      navigation.navigate('TaskGuide', { batchId: nextTask.batchId, batchNumber: nextTask.batchNumber });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#667eea']}
            tintColor="#667eea"
          />
        }
      >
        {/* 头部欢迎区 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {getGreeting()}，{user?.username ?? t('profile.role')}
            </Text>
            <Text style={styles.subTitle}>{t('home.subtitle')}</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Icon source="bell-outline" size={24} color="#fff" />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 下一批任务卡片 - 最醒目 */}
        {nextTask && (
          <View style={[styles.nextTaskCard, nextTask.isUrgent && styles.urgentCard]}>
            <View style={styles.nextTaskHeader}>
              <View>
                <View style={styles.nextTaskTitleRow}>
                  <Icon source="clipboard-list" size={20} color="#fff" />
                  <Text style={styles.nextTaskTitle}>{t('home.nextTask.title')}</Text>
                </View>
                <Text style={styles.nextTaskBatchNo}>{nextTask.batchNumber}</Text>
              </View>
              {nextTask.isUrgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>{t('home.nextTask.urgent')}</Text>
                </View>
              )}
            </View>

            <View style={styles.nextTaskInfo}>
              <View style={styles.nextTaskInfoRow}>
                <Icon source="fish" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.nextTaskInfoText}>{nextTask.productName} · {nextTask.targetQuantity}kg</Text>
              </View>
              <View style={styles.nextTaskInfoRow}>
                <Icon source="map-marker" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.nextTaskInfoText}>{nextTask.workshopLocation}</Text>
              </View>
              <View style={styles.nextTaskInfoRow}>
                <Icon source="account-group" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.nextTaskInfoText}>{t('home.nextTask.assignedWorkers', { count: nextTask.assignedWorkers })}</Text>
              </View>
              <View style={styles.nextTaskInfoRow}>
                <Icon source="clock-outline" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.nextTaskInfoText}>{t('home.nextTask.plannedStart', { time: nextTask.plannedStartTime })}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.startTaskBtn} onPress={handleStartTask}>
              <Text style={styles.startTaskBtnText}>{t('home.nextTask.startTask')}</Text>
              <Icon source="arrow-right" size={20} color="#667eea" />
            </TouchableOpacity>
          </View>
        )}

        {/* 排程任务区域 */}
        {scheduleTasks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>待执行排程</Text>
              <Text style={styles.viewMoreText}>{scheduleTasks.length}个任务</Text>
            </View>
            {scheduleTasks.slice(0, 3).map((task) => (
              <TouchableOpacity
                key={task.scheduleId}
                style={[styles.scheduleTaskCard, task.isUrgent && styles.urgentScheduleCard]}
                onPress={() => {
                  // 跳转到任务引导
                  if (task.batchNumber) {
                    navigation.navigate('TaskGuide', {
                      batchId: String(task.batchId),
                      batchNumber: task.batchNumber
                    });
                  }
                }}
              >
                <View style={styles.scheduleTaskHeader}>
                  <View>
                    <Text style={styles.scheduleLineName}>{task.productionLineName}</Text>
                    {task.batchNumber && (
                      <Text style={styles.scheduleBatchNo}>{task.batchNumber}</Text>
                    )}
                  </View>
                  {task.isUrgent && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentBadgeText}>紧急</Text>
                    </View>
                  )}
                </View>
                <View style={styles.scheduleTaskInfo}>
                  <Text style={styles.scheduleTaskInfoText}>
                    {task.productName || '待排产'} · 计划{task.plannedQuantity}kg
                  </Text>
                  <Text style={styles.scheduleTaskTime}>
                    {new Date(task.plannedStartTime).toLocaleTimeString('zh-CN', {
                      hour: '2-digit', minute: '2-digit'
                    })} - {new Date(task.plannedEndTime).toLocaleTimeString('zh-CN', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 今日任务概览 */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>{t('home.todayOverview')}</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#e6f7ff' }]}>
              <Text style={[styles.statValue, { color: '#1890ff' }]}>{taskStats.assigned}</Text>
              <Text style={styles.statLabel}>{t('home.stats.assigned')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fff7e6' }]}>
              <Text style={[styles.statValue, { color: '#fa8c16' }]}>{taskStats.inProgress}</Text>
              <Text style={styles.statLabel}>{t('home.stats.inProgress')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#f6ffed' }]}>
              <Text style={[styles.statValue, { color: '#52c41a' }]}>{taskStats.completed}</Text>
              <Text style={styles.statLabel}>{t('home.stats.completed')}</Text>
            </View>
          </View>
        </View>

        {/* 进行中批次 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.inProgressBatches')}</Text>
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('WSBatchesTab')}>
              <Text style={styles.viewMoreText}>{t('common.viewAll')}</Text>
            </TouchableOpacity>
          </View>

          {inProgressBatches.slice(0, 2).map((batch) => (
            <TouchableOpacity
              key={batch.batchId}
              style={styles.batchCard}
              onPress={() => navigation.navigate('BatchDetail', { batchId: batch.batchId })}
            >
              <View style={styles.batchHeader}>
                <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
                <View style={styles.stageBadge}>
                  <Text style={styles.stageBadgeText}>{batch.stage}</Text>
                </View>
              </View>
              <Text style={styles.batchProduct}>{batch.productName}</Text>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${batch.progress}%` }]} />
                </View>
                <Text style={styles.progressText}>{batch.progress}%</Text>
              </View>
              <View style={styles.batchFooter}>
                <Text style={styles.batchOutput}>{t('home.batch.output', { current: batch.currentOutput, target: batch.targetOutput })}</Text>
                <Text style={styles.batchTime}>{t('home.batch.estimated', { time: batch.estimatedTime })}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 人员状态 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.personnelStatus')}</Text>
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('WSWorkersTab')}>
              <Text style={styles.viewMoreText}>{t('common.viewAll')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusItem, { backgroundColor: '#f6ffed' }]}>
                <Text style={[styles.statusValue, { color: '#52c41a' }]}>{personnelStatus.onDuty}</Text>
                <Text style={styles.statusLabel}>{t('home.personnel.onDuty')}</Text>
              </View>
              <View style={[styles.statusItem, { backgroundColor: '#fff7e6' }]}>
                <Text style={[styles.statusValue, { color: '#fa8c16' }]}>{personnelStatus.onLeave}</Text>
                <Text style={styles.statusLabel}>{t('home.personnel.onLeave')}</Text>
              </View>
              <View style={[styles.statusItem, { backgroundColor: '#fff1f0' }]}>
                <Text style={[styles.statusValue, { color: '#ff4d4f' }]}>{personnelStatus.absent}</Text>
                <Text style={styles.statusLabel}>{t('home.personnel.absent')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 设备状态 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.equipmentStatus')}</Text>
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('WSEquipmentTab')}>
              <Text style={styles.viewMoreText}>{t('common.viewAll')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusItem, { backgroundColor: '#f6ffed' }]}>
                <Text style={[styles.statusValue, { color: '#52c41a' }]}>{equipmentStatus.running}</Text>
                <Text style={styles.statusLabel}>{t('home.equipment.running')}</Text>
              </View>
              <View style={[styles.statusItem, { backgroundColor: '#f0f5ff' }]}>
                <Text style={[styles.statusValue, { color: '#1890ff' }]}>{equipmentStatus.idle}</Text>
                <Text style={styles.statusLabel}>{t('home.equipment.idle')}</Text>
              </View>
              <View style={[styles.statusItem, { backgroundColor: '#fff1f0' }]}>
                <Text style={[styles.statusValue, { color: '#ff4d4f' }]}>{equipmentStatus.needMaintenance}</Text>
                <Text style={styles.statusLabel}>{t('home.equipment.needMaintenance')}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
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

  // 头部
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#667eea',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
  },
  subTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff4d4f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },

  // 下一批任务卡片
  nextTaskCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#667eea',
  },
  urgentCard: {
    backgroundColor: '#ff4d4f',
  },
  nextTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nextTaskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextTaskTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 6,
  },
  nextTaskBatchNo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  urgentBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgentBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  nextTaskInfo: {
    marginBottom: 16,
  },
  nextTaskInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  nextTaskInfoText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 8,
  },
  startTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
  },
  startTaskBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginRight: 8,
  },

  // 统计区
  statsSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },

  // 通用区块
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  viewMoreText: {
    fontSize: 14,
    color: '#667eea',
  },

  // 批次卡片
  batchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  stageBadge: {
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageBadgeText: {
    fontSize: 12,
    color: '#1890ff',
    fontWeight: '500',
  },
  batchProduct: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
    width: 40,
    textAlign: 'right',
  },
  batchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  batchOutput: {
    fontSize: 13,
    color: '#666',
  },
  batchTime: {
    fontSize: 13,
    color: '#999',
  },

  // 状态卡片
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // 排程任务卡片
  scheduleTaskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  urgentScheduleCard: {
    borderLeftColor: '#ff4d4f',
  },
  scheduleTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  scheduleLineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  scheduleBatchNo: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  scheduleTaskInfo: {
    marginTop: 4,
  },
  scheduleTaskInfoText: {
    fontSize: 14,
    color: '#666',
  },
  scheduleTaskTime: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
});

export default WSHomeScreen;
