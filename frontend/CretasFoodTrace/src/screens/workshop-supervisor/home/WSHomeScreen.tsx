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
import { WSHomeStackParamList } from '../../../types/navigation';
import { useAuthStore } from '../../../store/authStore';

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

  // 状态
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 模拟数据 (TODO: 接入真实API)
  const [nextTask, setNextTask] = useState<NextTask | null>({
    batchId: '1',
    batchNumber: 'PB-20251227-004',
    productName: '银鲳鱼片',
    targetQuantity: 70,
    plannedStartTime: '13:00',
    workshopLocation: 'A区-3号线',
    assignedWorkers: 3,
    equipment: '切片机A',
    isUrgent: false,
  });

  const [taskStats, setTaskStats] = useState<TaskStats>({
    assigned: 6,
    inProgress: 3,
    completed: 2,
  });

  const [inProgressBatches, setInProgressBatches] = useState<InProgressBatch[]>([
    {
      batchId: '1',
      batchNumber: 'PB-20251227-001',
      productName: '带鱼片',
      stage: '切片中',
      progress: 65,
      currentOutput: 52,
      targetOutput: 80,
      estimatedTime: '11:30',
    },
    {
      batchId: '2',
      batchNumber: 'PB-20251227-002',
      productName: '鲈鱼片',
      stage: '解冻中',
      progress: 30,
      currentOutput: 15,
      targetOutput: 50,
      estimatedTime: '14:00',
    },
  ]);

  const [personnelStatus, setPersonnelStatus] = useState<PersonnelStatus>({
    onDuty: 8,
    onLeave: 1,
    absent: 1,
    total: 10,
  });

  const [equipmentStatus, setEquipmentStatus] = useState<EquipmentStatus>({
    running: 3,
    idle: 1,
    needMaintenance: 1,
    total: 5,
  });

  // 获取问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '凌晨好';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 22) return '晚上好';
    return '夜深了';
  };

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      // TODO: 调用真实API
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('加载数据失败:', err);
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
          <Text style={styles.loadingText}>加载中...</Text>
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
              {getGreeting()}，{user?.username ?? '主任'}
            </Text>
            <Text style={styles.subTitle}>今日任务安排已更新</Text>
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
                  <Text style={styles.nextTaskTitle}>下一批任务</Text>
                </View>
                <Text style={styles.nextTaskBatchNo}>{nextTask.batchNumber}</Text>
              </View>
              {nextTask.isUrgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>紧急</Text>
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
                <Text style={styles.nextTaskInfoText}>已分配 {nextTask.assignedWorkers} 人</Text>
              </View>
              <View style={styles.nextTaskInfoRow}>
                <Icon source="clock-outline" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.nextTaskInfoText}>计划 {nextTask.plannedStartTime} 开始</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.startTaskBtn} onPress={handleStartTask}>
              <Text style={styles.startTaskBtnText}>开始任务</Text>
              <Icon source="arrow-right" size={20} color="#667eea" />
            </TouchableOpacity>
          </View>
        )}

        {/* 今日任务概览 */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>今日任务概览</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#e6f7ff' }]}>
              <Text style={[styles.statValue, { color: '#1890ff' }]}>{taskStats.assigned}</Text>
              <Text style={styles.statLabel}>已分配</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fff7e6' }]}>
              <Text style={[styles.statValue, { color: '#fa8c16' }]}>{taskStats.inProgress}</Text>
              <Text style={styles.statLabel}>进行中</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#f6ffed' }]}>
              <Text style={[styles.statValue, { color: '#52c41a' }]}>{taskStats.completed}</Text>
              <Text style={styles.statLabel}>已完成</Text>
            </View>
          </View>
        </View>

        {/* 进行中批次 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>进行中批次</Text>
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('WSBatchesTab')}>
              <Text style={styles.viewMoreText}>查看全部</Text>
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
                <Text style={styles.batchOutput}>{batch.currentOutput}kg / {batch.targetOutput}kg</Text>
                <Text style={styles.batchTime}>预计 {batch.estimatedTime}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 人员状态 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>人员状态</Text>
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('WSWorkersTab')}>
              <Text style={styles.viewMoreText}>查看全部</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusItem, { backgroundColor: '#f6ffed' }]}>
                <Text style={[styles.statusValue, { color: '#52c41a' }]}>{personnelStatus.onDuty}</Text>
                <Text style={styles.statusLabel}>在岗</Text>
              </View>
              <View style={[styles.statusItem, { backgroundColor: '#fff7e6' }]}>
                <Text style={[styles.statusValue, { color: '#fa8c16' }]}>{personnelStatus.onLeave}</Text>
                <Text style={styles.statusLabel}>请假</Text>
              </View>
              <View style={[styles.statusItem, { backgroundColor: '#fff1f0' }]}>
                <Text style={[styles.statusValue, { color: '#ff4d4f' }]}>{personnelStatus.absent}</Text>
                <Text style={styles.statusLabel}>缺勤</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 设备状态 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>设备状态</Text>
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('WSEquipmentTab')}>
              <Text style={styles.viewMoreText}>查看全部</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusItem, { backgroundColor: '#f6ffed' }]}>
                <Text style={[styles.statusValue, { color: '#52c41a' }]}>{equipmentStatus.running}</Text>
                <Text style={styles.statusLabel}>运行中</Text>
              </View>
              <View style={[styles.statusItem, { backgroundColor: '#f0f5ff' }]}>
                <Text style={[styles.statusValue, { color: '#1890ff' }]}>{equipmentStatus.idle}</Text>
                <Text style={styles.statusLabel}>空闲</Text>
              </View>
              <View style={[styles.statusItem, { backgroundColor: '#fff1f0' }]}>
                <Text style={[styles.statusValue, { color: '#ff4d4f' }]}>{equipmentStatus.needMaintenance}</Text>
                <Text style={styles.statusLabel}>需维护</Text>
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
});

export default WSHomeScreen;
